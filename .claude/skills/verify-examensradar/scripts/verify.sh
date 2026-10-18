#!/usr/bin/env bash
# Lifecycle for an isolated Examensradar verification instance.
#   verify.sh setup                 one-time: repo deps + Playwright toolchain
#   verify.sh launch [run-id]       fresh DB, SMTP sink, fixture page, dev server
#   verify.sh doctor <run-id>       read-only: is this instance safe and worth driving?
#   verify.sh mail <run-id>         list captured mail (index.jsonl)
#   verify.sh sql <run-id> "<sql>"  read-only query against the run's DB
#   verify.sh fixture <run-id> "<html>"  change the test JPA's watched page
#   verify.sh stop <run-id>         kill what launch started, keep evidence
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
ROOT="${EXAMENSRADAR_VERIFY_ROOT:-/tmp/examensradar-verify}"
TOOLS="$HOME/.cache/examensradar-verify/tools"

die() { echo "error: $*" >&2; exit 1; }
free_port() { bun -e 'const s=Bun.listen({hostname:"127.0.0.1",port:0,socket:{data(){}}});console.log(s.port);s.stop(true)'; }
# bun, not curl: the repo standardises on bun for fetching too.
# The timeout matters: vite's first request during a cold start can hang forever.
http_get() { bun -e 'const r=await fetch(process.argv[1],{signal:AbortSignal.timeout(5000)}).catch(()=>null);if(!r?.ok)process.exit(1);console.log(await r.text().catch(()=>process.exit(1)))' "$1"; }
run_dir() { [[ -n "${1:-}" ]] || die "run-id required"; local d="$ROOT/$1"; [[ -d "$d" ]] || die "no run at $d"; echo "$d"; }
load_env() { # shellcheck disable=SC1091
	source "$1/state/env"; }

cmd_setup() {
	[[ -d "$REPO/node_modules" ]] || (cd "$REPO" && bun install)
	mkdir -p "$TOOLS"
	[[ -f "$TOOLS/package.json" ]] || echo '{"name":"examensradar-verify-tools","private":true}' >"$TOOLS/package.json"
	[[ -d "$TOOLS/node_modules/playwright" ]] || (cd "$TOOLS" && bun add playwright)
	(cd "$TOOLS" && bunx playwright install chromium-headless-shell)
	echo "setup ok: repo deps + $TOOLS"
}

cmd_launch() {
	local id="${1:-run-$(date +%Y%m%d-%H%M%S)}" dir
	dir="$ROOT/$id"
	[[ -e "$dir/state" ]] && die "$dir/state exists — stop it first or pick another run-id"
	[[ -d "$REPO/node_modules" ]] || die "run 'verify.sh setup' first"
	mkdir -p "$dir/state" "$dir/evidence"

	local app smtp fix
	app=$(free_port); smtp=$(free_port); fix=$(free_port)
	cat >"$dir/state/env" <<EOF
RUN_ID=$id
RUN_DIR=$dir
EVIDENCE_DIR=$dir/evidence
APP_PORT=$app
BASE_URL=http://127.0.0.1:$app
SMTP_SINK_PORT=$smtp
FIXTURE_URL=http://127.0.0.1:$fix/results
DB=$dir/state/examensradar.db
ADMIN_PASSWORD=verify-admin
EOF
	load_env "$dir"

	# Sidecar first, so the app's very first mail has somewhere safe to go.
	setsid bun "$SKILL_DIR/scripts/sidecar.ts" "$dir/state" "$smtp" "$fix" >"$dir/state/sidecar.log" 2>&1 &
	echo $! >"$dir/state/sidecar.pid"

	# Fresh DB: migrations + seed, then disarm every seeded JPA's scraper (no
	# requests to real JPA sites) and add the one test JPA watching the fixture.
	(cd "$REPO" && DATABASE_PATH="$DB" bun scripts/migrate.ts && DATABASE_PATH="$DB" bun scripts/seed.ts) >"$dir/state/db-init.log" 2>&1
	bun -e '
		import { Database } from "bun:sqlite";
		const db = new Database(process.argv[1]);
		db.run("UPDATE jpa SET scrape_url = NULL, scrape_selector = NULL");
		db.run("INSERT INTO jpa (id, slug, name, website_url, scrape_url, scrape_selector, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			["jpa-verify-test", "verify-test", "JPA Verifikation (Test)", process.argv[2], process.argv[2], "article#results", Date.now()]);
		db.close();' "$DB" "$FIXTURE_URL"

	# Explicit env beats any .env.local vite would load — SMTP points at the sink.
	# setsid makes the server its own process group, so stop can kill exactly it.
	setsid env -C "$REPO" TZ=Europe/Berlin DATABASE_PATH="$DB" APP_URL="$BASE_URL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
		SMTP_HOST=127.0.0.1 SMTP_PORT="$smtp" SMTP_USER=verify SMTP_PASS=verify \
		MAIL_FROM=noreply@examensradar.test SCRAPE_INTERVAL_MS=86400000 \
		bunx --bun vite dev --host 127.0.0.1 --port "$app" --strictPort >"$dir/state/server.log" 2>&1 &
	echo $! >"$dir/state/server.pid"

	# Ready = usable: the tRPC list serves the test JPA and the scraper booted.
	for _ in $(seq 1 90); do
		if http_get "$BASE_URL/api/trpc/jpa.getAll" 2>/dev/null | grep -q verify-test \
			&& grep -q "\[scraper\] started" "$dir/state/server.log"; then
			echo "ready: $BASE_URL  run-id=$id  evidence=$EVIDENCE_DIR"
			return 0
		fi
		sleep 1
	done
	tail -20 "$dir/state/server.log" >&2
	die "server not ready after 90s (run 'verify.sh stop $id')"
}

cmd_doctor() {
	local dir ok=1; dir=$(run_dir "${1:-}"); load_env "$dir"
	check() { if eval "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1"; ok=0; fi; }
	local spid; spid=$(cat "$dir/state/server.pid" 2>/dev/null || echo 0)
	check "server pid $spid alive" "kill -0 $spid"
	check "sidecar alive" "kill -0 $(cat "$dir/state/sidecar.pid" 2>/dev/null || echo 0)"
	check "port $APP_PORT owned by our process group" \
		"ss -ltnp | grep ':$APP_PORT ' | grep -oP 'pid=\K[0-9]+' | xargs -I{} ps -o pgid= -p {} | grep -qw $spid"
	check "HTTP serves test JPA" "http_get $BASE_URL/api/trpc/jpa.getAll | grep -q verify-test"
	# The process actually listening (bunx's child) carries the app's env.
	local vpid; vpid=$(ss -ltnp | grep ":$APP_PORT " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
	check "app SMTP_HOST is the local sink" "tr '\0' '\n' </proc/$vpid/environ | grep -qx SMTP_HOST=127.0.0.1"
	check "app DATABASE_PATH is this run's DB" "tr '\0' '\n' </proc/$vpid/environ | grep -qx 'DATABASE_PATH=$DB'"
	check "only the test JPA has a scrape URL" \
		"[[ \$(bun -e 'import {Database} from \"bun:sqlite\";console.log(new Database(process.argv[1],{readonly:true}).query(\"select count(*) c from jpa where scrape_url is not null and id != ?\").get(\"jpa-verify-test\").c)' $DB) == 0 ]]"
	echo "build: $(git -C "$REPO" rev-parse --short HEAD)$(git -C "$REPO" diff --quiet || echo '+dirty')"
	[[ $ok == 1 ]] || die "doctor failed — do not drive this instance"
}

cmd_mail() { local dir; dir=$(run_dir "${1:-}"); cat "$dir/state/mail/index.jsonl" 2>/dev/null || echo "(no mail yet)"; }

cmd_sql() {
	local dir; dir=$(run_dir "${1:-}"); load_env "$dir"
	bun -e 'import {Database} from "bun:sqlite";console.log(JSON.stringify(new Database(process.argv[1],{readonly:true}).query(process.argv[2]).all(),null,1))' "$DB" "$2"
}

cmd_fixture() { local dir; dir=$(run_dir "${1:-}"); printf '%s' "$2" >"$dir/state/fixture.html"; echo "fixture updated"; }

cmd_stop() {
	local dir; dir=$(run_dir "${1:-}")
	for name in server sidecar; do
		local pid; pid=$(cat "$dir/state/$name.pid" 2>/dev/null || true)
		# setsid made each launch its own process group: kill only that group.
		[[ -n "$pid" ]] && kill -- "-$pid" 2>/dev/null || true
	done
	sleep 1
	mkdir -p "$dir/evidence/logs"
	cp "$dir"/state/*.log "$dir/evidence/logs/" 2>/dev/null || true
	[[ -d "$dir/state/mail" ]] && cp -r "$dir/state/mail" "$dir/evidence/"
	rm -rf "$dir/state"
	echo "stopped $1; evidence kept at $dir/evidence"
}

case "${1:-}" in
	setup | launch | doctor | mail | sql | fixture | stop) c=$1; shift; "cmd_$c" "$@" ;;
	*) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

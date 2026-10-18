// Verification sidecar: an SMTP sink the app sends all mail to, plus an HTTP
// fixture page the test JPA's scraper watches. Nothing leaves this machine.
//
//   bun sidecar.ts <state-dir> <smtp-port> <fixture-port>
//
// Mail lands in <state-dir>/mail/NNN.eml, one JSON line per message in
// <state-dir>/mail/index.jsonl ({ n, to, subject, links }).
// The fixture serves <state-dir>/fixture.html wrapped in
// <article id="results"> at http://127.0.0.1:<fixture-port>/results.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";

const [stateDir, smtpPort, fixturePort] = process.argv.slice(2);
if (!stateDir || !smtpPort || !fixturePort) {
	console.error("usage: bun sidecar.ts <state-dir> <smtp-port> <fixture-port>");
	process.exit(2);
}

const mailDir = `${stateDir}/mail`;
mkdirSync(mailDir, { recursive: true });
let count = 0;

/** Quoted-printable → UTF-8 text, so links and umlauts are readable. */
const decodeQp = (text: string) => {
	const bytes: number[] = [];
	const flat = text.replace(/=\r?\n/g, "");
	for (let i = 0; i < flat.length; i++) {
		const hex = flat.slice(i + 1, i + 3);
		if (flat[i] === "=" && /^[0-9A-F]{2}$/.test(hex)) {
			bytes.push(Number.parseInt(hex, 16));
			i += 2;
		} else bytes.push(flat.charCodeAt(i));
	}
	return new TextDecoder().decode(new Uint8Array(bytes));
};

/** RFC 2047 encoded words (=?UTF-8?Q?...?= / ?B?) in a header value. */
const decodeHeader = (value: string) =>
	value
		.replace(/\?=\s+=\?/g, "?==?")
		.replace(/=\?UTF-8\?([QB])\?([^?]*)\?=/gi, (_, enc, data) =>
			enc.toUpperCase() === "B"
				? Buffer.from(data, "base64").toString("utf8")
				: decodeQp(data.replace(/_/g, " ")),
		);

function store(rcpts: string[], raw: string) {
	count++;
	const n = String(count).padStart(3, "0");
	Bun.write(`${mailDir}/${n}.eml`, raw);
	const split = raw.indexOf("\r\n\r\n");
	const headers = raw.slice(0, split).replace(/\r\n[ \t]+/g, " ");
	const body = decodeQp(raw.slice(split + 4));
	const subject = decodeHeader(
		headers.match(/^Subject: (.*)$/m)?.[1]?.trim() ?? "(no subject)",
	);
	const links = [
		...new Set(body.match(/https?:\/\/[^\s"'<>)]+/g) ?? []),
	].filter((link) => !link.includes("w3.org"));
	appendFileSync(
		`${mailDir}/index.jsonl`,
		`${JSON.stringify({ n, to: rcpts, subject, links })}\n`,
	);
	console.log(`[sink] ${n} to=${rcpts.join(",")} subject=${subject}`);
}

type Session = {
	buffer: string;
	inData: boolean;
	authStep: number;
	rcpts: string[];
	data: string[];
};

Bun.listen<Session>({
	hostname: "127.0.0.1",
	port: Number(smtpPort),
	socket: {
		open(socket) {
			socket.data = {
				buffer: "",
				inData: false,
				authStep: 0,
				rcpts: [],
				data: [],
			};
			socket.write("220 examensradar-verify sink\r\n");
		},
		data(socket, chunk) {
			const s = socket.data;
			s.buffer += chunk.toString();
			let idx = s.buffer.indexOf("\r\n");
			while (idx !== -1) {
				const line = s.buffer.slice(0, idx);
				s.buffer = s.buffer.slice(idx + 2);
				idx = s.buffer.indexOf("\r\n");

				if (s.inData) {
					if (line === ".") {
						store(s.rcpts, s.data.join("\r\n"));
						s.inData = false;
						s.rcpts = [];
						s.data = [];
						socket.write("250 queued\r\n");
					} else {
						s.data.push(line.startsWith("..") ? line.slice(1) : line);
					}
					continue;
				}
				if (s.authStep > 0) {
					s.authStep = s.authStep === 1 ? 2 : 0;
					socket.write(
						s.authStep === 2 ? "334 UGFzc3dvcmQ6\r\n" : "235 ok\r\n",
					);
					continue;
				}

				const verb = line.slice(0, 4).toUpperCase();
				if (verb === "EHLO") {
					socket.write("250-examensradar-verify\r\n250 AUTH PLAIN LOGIN\r\n");
				} else if (verb === "HELO") socket.write("250 ok\r\n");
				else if (verb === "AUTH") {
					if (/^AUTH LOGIN\s*$/i.test(line)) {
						s.authStep = 1;
						socket.write("334 VXNlcm5hbWU6\r\n");
					} else socket.write("235 ok\r\n");
				} else if (verb === "RCPT") {
					s.rcpts.push(line.match(/<([^>]*)>/)?.[1] ?? line);
					socket.write("250 ok\r\n");
				} else if (verb === "DATA") {
					s.inData = true;
					socket.write("354 go\r\n");
				} else if (verb === "QUIT") {
					socket.write("221 bye\r\n");
					socket.end();
				} else socket.write("250 ok\r\n"); // MAIL, RSET, NOOP
			}
		},
	},
});

Bun.serve({
	hostname: "127.0.0.1",
	port: Number(fixturePort),
	fetch(request) {
		if (new URL(request.url).pathname !== "/results")
			return new Response("not found", { status: 404 });
		let content = "Noch keine Ergebnisse.";
		try {
			content = readFileSync(`${stateDir}/fixture.html`, "utf8");
		} catch {}
		return new Response(
			`<!doctype html><html><body><article id="results">${content}</article></body></html>`,
			{ headers: { "content-type": "text/html; charset=utf-8" } },
		);
	},
});

console.log(
	`[sidecar] ready smtp=127.0.0.1:${smtpPort} fixture=http://127.0.0.1:${fixturePort}/results`,
);

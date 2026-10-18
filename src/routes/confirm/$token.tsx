import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Loader2, MailCheck, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { StatusPage, statusLinkClass } from "@/components/ui/status-page";
import { trackEvent } from "@/lib/analytics";
import { noindex } from "@/lib/seo";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/confirm/$token")({
	head: () => ({
		meta: [{ title: "Anmeldung bestätigen | Examensradar" }, noindex],
	}),
	component: ConfirmPage,
});

/**
 * Confirmation happens on a button press, not on page load: mail scanners
 * follow links, and a GET that completes double opt-in would let a scanner
 * "consent" on the subscriber's behalf. The page does query the token's state
 * on load, so a re-opened link shows "bestätigt" instead of a dead button.
 */
function ConfirmPage() {
	const { token } = Route.useParams();

	const stateQuery = trpc.email.confirmState.useQuery({ token });
	const confirm = trpc.email.confirm.useMutation({
		// Nearly always one name — several only when JPAs were added while pending.
		onSuccess: (data) =>
			trackEvent("email_confirmed", { jpa: data.jpaNames.join(", ") }),
	});

	// Confirmed either just now (mutation, which alone carries the manage
	// token) or on an earlier visit (query, which deliberately does not: a
	// reopened link must not hand the credential to scanners or forwardees).
	const done = confirm.isSuccess
		? confirm.data
		: stateQuery.data?.state === "confirmed"
			? stateQuery.data
			: null;

	if (stateQuery.isLoading) return <PageSpinner />;

	if (done) {
		return (
			<StatusPage icon={CheckCircle} tone="ok" title="E-Mail bestätigt.">
				<p>
					Du wirst per E-Mail benachrichtigt, sobald neue Examensergebnisse
					veröffentlicht werden
					{done.jpaNames.length > 0 ? `: ${done.jpaNames.join(", ")}` : "."}
				</p>
				{"manageToken" in done ? (
					// The manage entry: /subscriptions trades the param for the cookie.
					<a
						href={`/subscriptions?manage=${done.manageToken}`}
						className="block"
					>
						<Button className="w-full sm:w-auto">Abo verwalten</Button>
					</a>
				) : (
					<p>
						Den Link zum Verwalten deines Abos findest du in deiner
						Willkommens-E-Mail.
					</p>
				)}
			</StatusPage>
		);
	}

	if (stateQuery.data?.state === "invalid") {
		return (
			<StatusPage icon={MailX} tone="bad" title="Link nicht mehr gültig">
				<p>
					Dieser Bestätigungslink ist abgelaufen oder wurde ersetzt. Melde dich
					einfach{" "}
					<a href="/#anmelden" className={statusLinkClass}>
						erneut an
					</a>
					, dann bekommst du einen neuen Link.
				</p>
			</StatusPage>
		);
	}

	return (
		<StatusPage icon={MailCheck} tone="pending" title="Anmeldung bestätigen">
			<p>
				Bestätige deine E-Mail-Adresse, um Benachrichtigungen über neue
				Examensergebnisse zu erhalten.
			</p>
			<Button
				onClick={() => confirm.mutate({ token })}
				disabled={confirm.isPending}
				size="lg"
				className="w-full sm:w-auto"
			>
				{confirm.isPending ? (
					<>
						<Loader2 className="w-5 h-5 animate-spin" />
						Bestätige …
					</>
				) : (
					"Jetzt bestätigen"
				)}
			</Button>
			{confirm.isError && (
				<Card variant="destructive" className="p-4 text-left">
					<p className="font-semibold text-ink">
						Dieser Bestätigungslink ist ungültig oder abgelaufen.
					</p>
					<p className="mt-1">
						Melde dich einfach{" "}
						<a href="/#anmelden" className={statusLinkClass}>
							erneut an
						</a>
						, dann bekommst du einen neuen Link.
					</p>
				</Card>
			)}
		</StatusPage>
	);
}

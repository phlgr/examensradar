import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Loader2, MailX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPage, statusLinkClass } from "@/components/ui/status-page";
import { trackEvent } from "@/lib/analytics";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/unsubscribe/$token")({
	head: () => ({ meta: [{ title: "Abmelden | Examensradar" }, noindex] }),
	component: UnsubscribePage,
});

type State = "idle" | "pending" | "done" | "invalid" | "error";

/**
 * The human-facing footer link. Unsubscribing happens on a button press via
 * the POST-only API route — the same one Gmail's one-click uses — so a scanner
 * following this GET link changes nothing.
 */
function UnsubscribePage() {
	const { token } = Route.useParams();
	const [state, setState] = useState<State>("idle");

	const unsubscribe = async () => {
		setState("pending");
		try {
			const response = await fetch(`/api/email/unsubscribe/${token}`, {
				method: "POST",
			});
			if (response.ok) {
				trackEvent("email_unsubscribed");
				setState("done");
			} else {
				setState(response.status === 404 ? "invalid" : "error");
			}
		} catch {
			setState("error");
		}
	};

	if (state === "done") {
		return (
			<StatusPage icon={CheckCircle} tone="ok" title="Abgemeldet.">
				<p>
					Du erhältst keine E-Mails mehr von Examensradar. Falls du es dir
					anders überlegst, kannst du dich jederzeit{" "}
					<a href="/#anmelden" className={statusLinkClass}>
						neu anmelden
					</a>
					.
				</p>
			</StatusPage>
		);
	}

	return (
		<StatusPage icon={MailX} tone="bad" title="Abmelden">
			<p>
				Möchtest du keine E-Mails über neue Examensergebnisse mehr erhalten?
			</p>
			<Button
				variant="destructive"
				size="lg"
				onClick={unsubscribe}
				disabled={state === "pending"}
				className="w-full sm:w-auto"
			>
				{state === "pending" ? (
					<>
						<Loader2 className="w-5 h-5 animate-spin" />
						Melde ab …
					</>
				) : (
					"Jetzt abmelden"
				)}
			</Button>
			{state === "invalid" && (
				<Card variant="muted" className="p-4 text-left">
					<p className="font-semibold text-ink">
						Dieser Link ist nicht mehr gültig.
					</p>
					<p className="mt-1">
						Nutze den Abmelde-Link aus einer neueren E-Mail.
					</p>
				</Card>
			)}
			{state === "error" && (
				<Card variant="muted" className="p-4 text-left">
					<p className="font-semibold text-ink">
						Das hat nicht geklappt. Bitte versuch es noch einmal.
					</p>
				</Card>
			)}
		</StatusPage>
	);
}

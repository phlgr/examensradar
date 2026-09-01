import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Loader2, MailX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/unsubscribe/$token")({
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
			<Shell>
				<div className="bg-nb-mint w-16 h-16 sm:w-20 sm:h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
					<CheckCircle className="w-8 h-8 sm:w-10 sm:h-10" />
				</div>
				<div>
					<h1 className="text-2xl sm:text-3xl font-black uppercase mb-2">
						Abgemeldet
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Du erhältst keine E-Mails mehr von Examensradar. Falls du es dir
						anders überlegst, kannst du dich jederzeit{" "}
						<a
							href="/subscriptions"
							className="underline decoration-2 font-bold"
						>
							neu anmelden
						</a>
						.
					</p>
				</div>
			</Shell>
		);
	}

	return (
		<Shell>
			<div className="bg-nb-coral w-16 h-16 sm:w-20 sm:h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
				<MailX className="w-8 h-8 sm:w-10 sm:h-10" />
			</div>
			<div>
				<h1 className="text-2xl sm:text-3xl font-black uppercase mb-2">
					Abmelden
				</h1>
				<p className="font-medium text-sm sm:text-base">
					Möchtest du keine E-Mails über neue Examensergebnisse mehr erhalten?
				</p>
			</div>
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
						Melde ab...
					</>
				) : (
					"Jetzt abmelden"
				)}
			</Button>
			{state === "invalid" && (
				<Card variant="muted" className="p-4 text-left">
					<p className="font-bold text-sm">
						Dieser Link ist nicht mehr gültig.
					</p>
					<p className="text-sm font-medium mt-1">
						Nutze den Abmelde-Link aus einer neueren E-Mail.
					</p>
				</Card>
			)}
			{state === "error" && (
				<Card variant="muted" className="p-4 text-left">
					<p className="font-bold text-sm">
						Das hat nicht geklappt. Bitte versuche es erneut.
					</p>
				</Card>
			)}
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex-1 flex items-center justify-center px-4 py-12 bg-nb-cream">
			<Card className="w-full max-w-lg p-6 sm:p-10">
				<div className="text-center space-y-4 sm:space-y-6">{children}</div>
			</Card>
		</div>
	);
}

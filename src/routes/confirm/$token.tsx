import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Loader2, MailCheck, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/confirm/$token")({
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
		onSuccess: () => trackEvent("email_confirmed"),
	});

	// Confirmed either just now (mutation) or on an earlier visit (query).
	const done = confirm.isSuccess
		? confirm.data
		: stateQuery.data?.state === "confirmed"
			? stateQuery.data
			: null;

	if (stateQuery.isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	if (done) {
		return (
			<Shell>
				<div className="bg-nb-mint w-16 h-16 sm:w-20 sm:h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
					<CheckCircle className="w-8 h-8 sm:w-10 sm:h-10" />
				</div>
				<div>
					<h1 className="text-2xl sm:text-3xl font-black uppercase mb-2">
						E-Mail bestätigt!
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Du wirst per E-Mail benachrichtigt, sobald neue Examensergebnisse
						veröffentlicht werden
						{done.jpaNames.length > 0 ? `: ${done.jpaNames.join(", ")}` : "."}
					</p>
				</div>
				{/* The manage entry: /subscriptions trades the param for the cookie. */}
				<a href={`/subscriptions?manage=${done.manageToken}`} className="block">
					<Button className="w-full sm:w-auto">Abo verwalten</Button>
				</a>
			</Shell>
		);
	}

	if (stateQuery.data?.state === "invalid") {
		return (
			<Shell>
				<div className="bg-nb-coral w-16 h-16 sm:w-20 sm:h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
					<MailX className="w-8 h-8 sm:w-10 sm:h-10" />
				</div>
				<div>
					<h1 className="text-2xl sm:text-3xl font-black uppercase mb-2">
						Link nicht mehr gültig
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Dieser Bestätigungslink ist abgelaufen oder wurde ersetzt. Melde
						dich einfach{" "}
						<a
							href="/subscriptions"
							className="underline decoration-2 font-bold"
						>
							erneut an
						</a>
						, dann bekommst du einen neuen Link.
					</p>
				</div>
			</Shell>
		);
	}

	return (
		<Shell>
			<div className="bg-nb-yellow w-16 h-16 sm:w-20 sm:h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
				<MailCheck className="w-8 h-8 sm:w-10 sm:h-10" />
			</div>
			<div>
				<h1 className="text-2xl sm:text-3xl font-black uppercase mb-2">
					Anmeldung bestätigen
				</h1>
				<p className="font-medium text-sm sm:text-base">
					Bestätige deine E-Mail-Adresse, um Benachrichtigungen über neue
					Examensergebnisse zu erhalten.
				</p>
			</div>
			<Button
				onClick={() => confirm.mutate({ token })}
				disabled={confirm.isPending}
				size="lg"
				className="w-full sm:w-auto"
			>
				{confirm.isPending ? (
					<>
						<Loader2 className="w-5 h-5 animate-spin" />
						Bestätige...
					</>
				) : (
					"Jetzt bestätigen"
				)}
			</Button>
			{confirm.isError && (
				<Card variant="destructive" className="p-4 text-left">
					<p className="font-bold text-sm">
						Dieser Bestätigungslink ist ungültig oder abgelaufen.
					</p>
					<p className="text-sm font-medium mt-1">
						Melde dich einfach{" "}
						<a
							href="/subscriptions"
							className="underline decoration-2 font-bold"
						>
							erneut an
						</a>
						, dann bekommst du einen neuen Link.
					</p>
				</Card>
			)}
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-12 bg-nb-cream">
			<Card className="w-full max-w-lg p-6 sm:p-10">
				<div className="text-center space-y-4 sm:space-y-6">{children}</div>
			</Card>
		</div>
	);
}

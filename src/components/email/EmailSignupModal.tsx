import { Loader2, Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Modal,
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@/components/ui/modal";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

interface EmailSignupModalProps {
	open: boolean;
	onClose: () => void;
	jpaId: string;
	jpaName: string;
}

/**
 * The whole signup: type an address, get a mail, done. The reply is the same
 * whether the address is new, already subscribed or throttled — what differs
 * arrives in the inbox — so the success copy only ever promises "a mail".
 */
export function EmailSignupModal({
	open,
	onClose,
	jpaId,
	jpaName,
}: EmailSignupModalProps) {
	// The parent mounts this fresh per signup attempt, so state needs no reset.
	const [email, setEmail] = useState("");

	const subscribe = trpc.email.subscribe.useMutation({
		onSuccess: () => trackEvent("email_subscribe", { jpa: jpaName }),
	});

	const canSubmit = email.includes("@") && !subscribe.isPending;

	const submit = () => {
		if (!canSubmit) return;
		subscribe.mutate({ email, jpaId });
	};

	return (
		<Modal open={open} onClose={onClose} size="lg">
			<ModalHeader>
				<ModalTitle>
					{subscribe.isSuccess
						? "Schau in dein Postfach"
						: "Per E-Mail abonnieren"}
				</ModalTitle>
			</ModalHeader>

			<ModalBody>
				{subscribe.isSuccess ? (
					<div className="space-y-4 sm:space-y-6 text-center">
						<div className="bg-nb-mint w-16 h-16 sm:w-20 sm:h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
							<MailCheck className="w-8 h-8 sm:w-10 sm:h-10" />
						</div>
						<p className="font-medium text-sm sm:text-base">
							Wir haben eine E-Mail an <strong>{email}</strong> geschickt. Öffne
							den Link darin, um die Anmeldung abzuschließen.
						</p>
						<Card variant="muted" className="p-3 sm:p-4 text-left">
							<p className="text-xs sm:text-sm font-medium">
								<strong>Keine E-Mail?</strong> Prüfe deinen Spam-Ordner. Du
								kannst es in einer Stunde erneut versuchen.
							</p>
						</Card>
					</div>
				) : (
					<div className="space-y-4 sm:space-y-6">
						<div className="flex items-start gap-3 sm:gap-4">
							<div className="bg-nb-yellow p-2 sm:p-3 border-3 sm:border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
								<Mail className="w-6 h-6 sm:w-8 sm:h-8" />
							</div>
							<div className="flex-1 min-w-0">
								<h3 className="text-base sm:text-lg font-black uppercase mb-2">
									{jpaName}
								</h3>
								<p className="font-medium text-sm sm:text-base">
									Trag deine E-Mail-Adresse ein — du bekommst eine Nachricht,
									sobald neue Examensergebnisse veröffentlicht werden. Keine
									App, kein Konto.
								</p>
							</div>
						</div>

						<form
							onSubmit={(event) => {
								event.preventDefault();
								submit();
							}}
						>
							<Input
								type="email"
								autoComplete="email"
								placeholder="deine@email.de"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
						</form>

						{subscribe.isError && (
							<Card variant="muted" className="p-3 text-left">
								<p className="text-xs sm:text-sm font-bold text-nb-coral">
									Das hat nicht geklappt. Bitte versuche es erneut.
								</p>
							</Card>
						)}
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				{subscribe.isSuccess ? (
					<>
						<div className="flex-1" />
						<Button onClick={onClose}>Fertig</Button>
					</>
				) : (
					<>
						<Button variant="ghost" onClick={onClose}>
							Abbrechen
						</Button>
						<div className="flex-1" />
						<Button onClick={submit} disabled={!canSubmit}>
							{subscribe.isPending ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" />
									Sende...
								</>
							) : (
								"Abonnieren"
							)}
						</Button>
					</>
				)}
			</ModalFooter>
		</Modal>
	);
}

import { Loader2, Mail, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconBox } from "@/components/ui/icon-box";
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

	// Top of the signup funnel: seeing the form. Paired with email_subscribe
	// and email_confirmed, Plausible can then chart drop-off per step and JPA.
	useEffect(() => {
		if (open) trackEvent("email_signup_open", { jpa: jpaName });
	}, [open, jpaName]);

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
						? "Fast geschafft"
						: "Per E-Mail benachrichtigen lassen"}
				</ModalTitle>
			</ModalHeader>

			<ModalBody>
				{subscribe.isSuccess ? (
					<div className="space-y-4 sm:space-y-6 text-center">
						<IconBox color="mint" size="lg" shadow className="mx-auto">
							<MailCheck className="w-8 h-8" />
						</IconBox>
						<p className="font-medium text-sm sm:text-base">
							Wir haben eine E-Mail an <strong>{email}</strong> geschickt.
							Bestätige darin kurz deine Adresse – dann ist alles eingerichtet.
						</p>
						<Card variant="muted" className="p-3 sm:p-4 text-left">
							<p className="text-xs sm:text-sm font-medium">
								<strong>Keine E-Mail bekommen?</strong> Schau in deinen
								Spam-Ordner oder versuch es einfach noch einmal.
							</p>
						</Card>
					</div>
				) : (
					<div className="space-y-4 sm:space-y-6">
						<div className="flex items-start gap-3 sm:gap-4">
							<IconBox shadow>
								<Mail className="w-5 h-5" />
							</IconBox>
							<div className="flex-1 min-w-0">
								<h3 className="text-base sm:text-lg font-black uppercase mb-2">
									{jpaName}
								</h3>
								<p className="font-medium text-sm sm:text-base">
									Trag deine E-Mail-Adresse ein. Sobald dieses Prüfungsamt neue
									Examensergebnisse veröffentlicht, bekommst du eine E-Mail von
									uns.
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
								placeholder="name@beispiel.de"
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

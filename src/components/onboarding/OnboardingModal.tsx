import {
	Check,
	Copy,
	Download,
	ExternalLink,
	Loader2,
	Send,
	Smartphone,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeInput } from "@/components/ui/code-input";
import {
	Modal,
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@/components/ui/modal";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { trpc } from "@/lib/trpc";

interface OnboardingModalProps {
	open: boolean;
	onClose: () => void;
	ntfyTopic: string;
	subscriptionId: string;
	isFirstSubscription?: boolean;
	jpaName?: string;
}

type StepType = "download" | "subscribe" | "test" | "complete";

export function OnboardingModal({
	open,
	onClose,
	ntfyTopic,
	subscriptionId,
	isFirstSubscription = true,
	jpaName,
}: OnboardingModalProps) {
	// Define steps based on subscription type
	const stepConfig: StepType[] = isFirstSubscription
		? ["download", "subscribe", "test", "complete"]
		: ["subscribe", "test", "complete"];
	
	const stepLabels = {
		download: "Herunterladen",
		subscribe: "Abonnieren",
		test: "Testen",
		complete: "Fertig",
	};

	// State
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [copied, setCopied] = useState(false);
	const [verificationCode, setVerificationCode] = useState("");
	const [codeVerified, setCodeVerified] = useState(false);
	const [codeError, setCodeError] = useState(false);
	const [sendError, setSendError] = useState<string | null>(null);
	const lastSubmittedCode = useRef<string | null>(null);

	const currentStep = stepConfig[currentStepIndex];
	const isLastStep = currentStepIndex === stepConfig.length - 1;

	// Reset state when modal opens
	useEffect(() => {
		if (open) {
			setCurrentStepIndex(0);
			setCopied(false);
			setVerificationCode("");
			setCodeVerified(false);
			setCodeError(false);
			setSendError(null);
			lastSubmittedCode.current = null;
		}
	}, [open]);

	// Mutations
	const completeOnboarding = trpc.user.completeOnboarding.useMutation({
		onSuccess: onClose,
	});

	const sendTestNotification = trpc.user.sendTestNotification.useMutation({
		onSuccess: () => {
			setCodeError(false);
			setSendError(null);
		},
		onError: (error) => {
			setSendError(error.message || "Fehler beim Senden der Benachrichtigung");
		},
	});

	const verifyTestCode = trpc.user.verifyTestCode.useMutation({
		onSuccess: () => {
			setCodeVerified(true);
			setCodeError(false);
		},
		onError: () => {
			setCodeError(true);
		},
	});

	// Handlers
	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(ntfyTopic);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [ntfyTopic]);

	const handleNext = () => {
		if (!isLastStep) {
			setCurrentStepIndex((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStepIndex > 0) {
			setCurrentStepIndex((prev) => prev - 1);
		}
	};

	const handleSendTest = () => {
		setVerificationCode("");
		setCodeVerified(false);
		lastSubmittedCode.current = null;
		sendTestNotification.mutate({ ntfyTopic });
	};

	// Auto-submit verification code when complete
	useEffect(() => {
		const shouldSubmit =
			verificationCode.length === 6 &&
			!verifyTestCode.isPending &&
			!codeVerified &&
			lastSubmittedCode.current !== verificationCode;

		if (shouldSubmit) {
			lastSubmittedCode.current = verificationCode;
			verifyTestCode.mutate({ code: verificationCode });
		}
	}, [verificationCode, codeVerified, verifyTestCode]);

	// Clear error when user changes code
	useEffect(() => {
		if (verificationCode.length > 0 && verificationCode !== lastSubmittedCode.current) {
			setCodeError(false);
		}
	}, [verificationCode]);

	// Render current step
	const renderStep = () => {
		switch (currentStep) {
			case "download":
				return <StepDownload />;
			case "subscribe":
				return (
					<StepSubscribe
						ntfyTopic={ntfyTopic}
						copied={copied}
						onCopy={handleCopy}
						jpaName={jpaName}
					/>
				);
			case "test":
				return (
					<StepTest
						onSendTest={handleSendTest}
						verificationCode={verificationCode}
						setVerificationCode={setVerificationCode}
						codeVerified={codeVerified}
						codeError={codeError}
						sendError={sendError}
						isSending={sendTestNotification.isPending}
						isVerifying={verifyTestCode.isPending}
						hasSentCode={sendTestNotification.isSuccess}
					/>
				);
			case "complete":
				return <StepComplete isFirstSubscription={isFirstSubscription} jpaName={jpaName} />;
		}
	};

	const canProceed = currentStep !== "test" || codeVerified;

	return (
		<Modal open={open} onClose={onClose} size="lg" closeOnOverlayClick={false}>
			<ModalHeader>
				<ModalTitle>
					{isFirstSubscription
						? "Push-Benachrichtigungen einrichten"
						: "Neues Abonnement einrichten"}
				</ModalTitle>
				<p className="font-medium mt-2">
					{isFirstSubscription
						? "Folge diesen Schritten, um keine Ergebnisse mehr zu verpassen."
						: `Richte Benachrichtigungen für ${jpaName || "dieses JPA"} ein.`}
				</p>
				<ProgressSteps
					steps={stepConfig.map((step) => stepLabels[step])}
					currentStep={currentStepIndex}
					className="mt-6"
				/>
			</ModalHeader>

			<ModalBody>{renderStep()}</ModalBody>

			<ModalFooter>
				{currentStepIndex > 0 && (
					<Button variant="secondary" onClick={handleBack}>
						Zurück
					</Button>
				)}
				{currentStepIndex === 0 && (
					<Button variant="ghost" onClick={onClose}>
						{isFirstSubscription ? "Später einrichten" : "Überspringen"}
					</Button>
				)}
				<div className="flex-1" />
				{!isLastStep ? (
					<Button onClick={handleNext} disabled={!canProceed}>
						Weiter
					</Button>
				) : (
					<Button
						onClick={() => completeOnboarding.mutate({ subscriptionId })}
						disabled={completeOnboarding.isPending}
					>
						{completeOnboarding.isPending ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							"Fertig"
						)}
					</Button>
				)}
			</ModalFooter>
		</Modal>
	);
}

function StepDownload() {
	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="flex items-start gap-3 sm:gap-4">
				<div className="bg-nb-yellow p-2 sm:p-3 border-3 sm:border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
					<Download className="w-6 h-6 sm:w-8 sm:h-8" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-base sm:text-lg font-black uppercase mb-2">
						1. ntfy App herunterladen
					</h3>
					<p className="font-medium text-sm sm:text-base">
						Die ntfy App ist kostenlos und ermöglicht dir, Push-Benachrichtigungen
						auf all deinen Geräten zu empfangen.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-2 sm:gap-4">
				<a
					href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
					target="_blank"
					rel="noopener noreferrer"
					className="block"
				>
					<Card hover className="p-2 sm:p-4 text-center">
						<Smartphone className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2" />
						<span className="font-bold text-xs sm:text-sm uppercase block">
							Android
						</span>
						<ExternalLink className="w-2.5 h-2.5 sm:w-4 sm:h-4 mx-auto mt-1 sm:mt-2" />
					</Card>
				</a>
				<a
					href="https://apps.apple.com/app/ntfy/id1625396347"
					target="_blank"
					rel="noopener noreferrer"
					className="block"
				>
					<Card hover className="p-2 sm:p-4 text-center">
						<Smartphone className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2" />
						<span className="font-bold text-xs sm:text-sm uppercase block">iOS</span>
						<ExternalLink className="w-2.5 h-2.5 sm:w-4 sm:h-4 mx-auto mt-1 sm:mt-2" />
					</Card>
				</a>
				<a
					href="https://ntfy.sh"
					target="_blank"
					rel="noopener noreferrer"
					className="block"
				>
					<Card hover className="p-2 sm:p-4 text-center">
						<Smartphone className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2" />
						<span className="font-bold text-xs sm:text-sm uppercase block">Web</span>
						<ExternalLink className="w-2.5 h-2.5 sm:w-4 sm:h-4 mx-auto mt-1 sm:mt-2" />
					</Card>
				</a>
			</div>

			<Card variant="muted" className="p-3 sm:p-4">
				<p className="text-xs sm:text-sm font-medium">
					<strong>Wichtig:</strong> Du musst die App auf jedem Gerät installieren,
					auf dem du Benachrichtigungen erhalten möchtest.
				</p>
			</Card>
		</div>
	);
}

function StepSubscribe({
	ntfyTopic,
	copied,
	onCopy,
	jpaName,
}: {
	ntfyTopic: string;
	copied: boolean;
	onCopy: () => void;
	jpaName?: string;
}) {
	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="flex items-start gap-3 sm:gap-4">
				<div className="bg-nb-teal p-2 sm:p-3 border-3 sm:border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
					<Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-base sm:text-lg font-black uppercase mb-2">
						{jpaName ? `Kanal für ${jpaName} abonnieren` : "Deinen Kanal abonnieren"}
					</h3>
					<p className="font-medium text-sm sm:text-base">
						Öffne die ntfy App und abonniere deinen persönlichen Kanal.
					</p>
				</div>
			</div>

			<Card variant="primary" className="p-4 sm:p-6">
				<p className="text-xs sm:text-sm font-bold uppercase mb-3">
					Dein ntfy Kanal:
				</p>
				<div className="flex items-center gap-2 sm:gap-3">
					<code className="flex-1 bg-nb-white px-3 sm:px-4 py-2 sm:py-3 border-2 sm:border-3 border-nb-black font-bold text-sm sm:text-lg break-all">
						{ntfyTopic}
					</code>
					<Button
						variant="icon"
						size="icon"
						onClick={onCopy}
						title="Kopieren"
						className="shrink-0"
					>
						{copied ? (
							<Check className="w-4 h-4 sm:w-5 sm:h-5" />
						) : (
							<Copy className="w-4 h-4 sm:w-5 sm:h-5" />
						)}
					</Button>
				</div>
			</Card>

			<div className="space-y-3">
				<h4 className="font-black uppercase text-sm sm:text-base">So geht's:</h4>
				<ol className="space-y-2 font-medium text-sm sm:text-base">
					{["Öffne die ntfy App", "Tippe auf das + Symbol", "Füge den kopierten Kanal-Namen ein", "Tippe auf \"Subscribe\""].map((step, i) => (
						<li key={step} className="flex items-start gap-2 sm:gap-3">
							<span className="bg-nb-yellow px-2 py-0.5 border-2 border-nb-black font-black text-xs sm:text-sm shrink-0">
								{i + 1}
							</span>
							<span>{step}</span>
						</li>
					))}
				</ol>
			</div>

			<Card variant="accent" className="p-3 sm:p-4">
				<p className="text-xs sm:text-sm font-medium">
					<strong>Tipp:</strong> Wiederhole diesen Schritt auf jedem Gerät, auf dem
					du Benachrichtigungen erhalten möchtest.
				</p>
			</Card>
		</div>
	);
}

function StepTest({
	onSendTest,
	verificationCode,
	setVerificationCode,
	codeVerified,
	codeError,
	sendError,
	isSending,
	isVerifying,
	hasSentCode,
}: {
	onSendTest: () => void;
	verificationCode: string;
	setVerificationCode: (code: string) => void;
	codeVerified: boolean;
	codeError: boolean;
	sendError: string | null;
	isSending: boolean;
	isVerifying: boolean;
	hasSentCode: boolean;
}) {
	if (codeVerified) {
		return (
			<div className="space-y-4 sm:space-y-6">
				<div className="flex items-start gap-3 sm:gap-4">
					<div className="bg-nb-coral p-2 sm:p-3 border-3 sm:border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
						<Send className="w-6 h-6 sm:w-8 sm:h-8" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="text-base sm:text-lg font-black uppercase mb-2">
							Einrichtung testen
						</h3>
						<p className="font-medium text-sm sm:text-base">
							Lass uns prüfen, ob alles funktioniert. Wir senden dir eine
							Testbenachrichtigung mit einem Code.
						</p>
					</div>
				</div>

				<Card variant="success" className="p-4 sm:p-6 text-center">
					<div className="bg-nb-white w-12 h-12 sm:w-16 sm:h-16 border-3 sm:border-4 border-nb-black mx-auto flex items-center justify-center mb-3 sm:mb-4">
						<Check className="w-6 h-6 sm:w-8 sm:h-8" />
					</div>
					<h4 className="font-black uppercase text-base sm:text-lg mb-2">
						Code bestätigt!
					</h4>
					<p className="font-medium text-sm sm:text-base">
						Deine Push-Benachrichtigungen sind eingerichtet.
					</p>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="flex items-start gap-3 sm:gap-4">
				<div className="bg-nb-coral p-2 sm:p-3 border-3 sm:border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
					<Send className="w-6 h-6 sm:w-8 sm:h-8" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-base sm:text-lg font-black uppercase mb-2">
						Einrichtung testen
					</h3>
					<p className="font-medium text-sm sm:text-base">
						Lass uns prüfen, ob alles funktioniert. Wir senden dir eine
						Testbenachrichtigung mit einem Code.
					</p>
				</div>
			</div>

			<div className="text-center space-y-3">
				<Button
					onClick={onSendTest}
					disabled={isSending}
					variant="default"
					size="default"
					className="w-full sm:w-auto"
				>
					{isSending ? (
						<>
							<Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
							Sende...
						</>
					) : hasSentCode ? (
						<>
							<Send className="w-4 h-4 sm:w-5 sm:h-5" />
							Erneut senden
						</>
					) : (
						<>
							<Send className="w-4 h-4 sm:w-5 sm:h-5" />
							Test-Benachrichtigung senden
						</>
					)}
				</Button>

				{sendError && (
					<Card variant="muted" className="p-3 text-left">
						<p className="text-xs sm:text-sm font-bold text-nb-coral">
							{sendError}
						</p>
					</Card>
				)}

				{hasSentCode && !sendError && (
					<p className="text-xs sm:text-sm font-medium text-nb-black/60">
						Code kommt nicht an? Du kannst die Benachrichtigung jederzeit erneut
						senden.
					</p>
				)}
			</div>

			{hasSentCode && (
				<div className="space-y-4">
					<p className="text-center font-medium text-sm sm:text-base">
						Gib den 6-stelligen Code aus deiner Push-Benachrichtigung ein:
					</p>
					<CodeInput
						value={verificationCode}
						onChange={setVerificationCode}
						error={codeError}
						disabled={isVerifying}
					/>
					{isVerifying && (
						<div className="flex items-center justify-center gap-2 text-sm font-bold">
							<Loader2 className="w-4 h-4 animate-spin" />
							<span>Prüfe Code...</span>
						</div>
					)}
					{codeError && !isVerifying && (
						<p className="text-center text-xs sm:text-sm font-bold text-nb-coral">
							Ungültiger oder abgelaufener Code. Bitte versuche es erneut.
						</p>
					)}
				</div>
			)}

			<Card variant="muted" className="p-3 sm:p-4">
				<p className="text-xs sm:text-sm font-medium">
					<strong>Keine Benachrichtigung erhalten?</strong> Stelle sicher, dass du
					den Kanal in der ntfy App abonniert hast und Benachrichtigungen aktiviert
					sind.
				</p>
			</Card>
		</div>
	);
}

function StepComplete({
	isFirstSubscription,
	jpaName,
}: {
	isFirstSubscription: boolean;
	jpaName?: string;
}) {
	return (
		<div className="text-center space-y-4 sm:space-y-6">
			<div className="bg-nb-mint w-16 h-16 sm:w-20 sm:h-20 border-3 sm:border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
				<Check className="w-8 h-8 sm:w-10 sm:h-10" />
			</div>
			<div>
				<h3 className="text-xl sm:text-2xl font-black uppercase mb-2">
					{isFirstSubscription ? "Alles eingerichtet!" : "Abonnement aktiv!"}
				</h3>
				<p className="font-medium text-sm sm:text-base max-w-md mx-auto px-2">
					{isFirstSubscription
						? "Du erhältst jetzt Push-Benachrichtigungen, sobald neue Examensergebnisse veröffentlicht werden."
						: `Du erhältst jetzt Benachrichtigungen für ${jpaName || "dieses JPA"}.`}
				</p>
			</div>
			<Card variant="muted" className="p-3 sm:p-4 text-left">
				<p className="text-xs sm:text-sm font-medium">
					<strong>Hinweis:</strong> Du kannst deine ntfy Kanäle jederzeit unter
					Benachrichtigungen einsehen und auf weiteren Geräten einrichten.
				</p>
			</Card>
		</div>
	);
}

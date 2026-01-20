import {
	Check,
	Copy,
	Download,
	ExternalLink,
	Loader2,
	Send,
	Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
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
	/** If true, shows full onboarding (first subscription). If false, shows simplified test flow. */
	isFirstSubscription?: boolean;
	/** Name of the JPA for display purposes */
	jpaName?: string;
}

const FULL_STEPS = ["Herunterladen", "Abonnieren", "Testen", "Fertig"];
const TEST_STEPS = ["Abonnieren", "Testen", "Fertig"];

export function OnboardingModal({
	open,
	onClose,
	ntfyTopic,
	subscriptionId,
	isFirstSubscription = true,
	jpaName,
}: OnboardingModalProps) {
	const steps = isFirstSubscription ? FULL_STEPS : TEST_STEPS;
	const [currentStep, setCurrentStep] = useState(0);
	const [copied, setCopied] = useState(false);
	const [verificationCode, setVerificationCode] = useState("");
	const [codeVerified, setCodeVerified] = useState(false);
	const [codeError, setCodeError] = useState(false);

	// Reset state when modal opens
	useEffect(() => {
		if (open) {
			setCurrentStep(0);
			setCopied(false);
			setVerificationCode("");
			setCodeVerified(false);
			setCodeError(false);
		}
	}, [open]);

	const completeOnboarding = trpc.user.completeOnboarding.useMutation({
		onSuccess: () => {
			onClose();
		},
	});

	const sendTestNotification = trpc.user.sendTestNotification.useMutation({
		onSuccess: () => {
			setCodeError(false);
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

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(ntfyTopic);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleNext = () => {
		if (currentStep < steps.length - 1) {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const handleComplete = () => {
		completeOnboarding.mutate({ subscriptionId });
	};

	const handleSkip = () => {
		onClose();
	};

	const handleSendTest = () => {
		setVerificationCode("");
		setCodeVerified(false);
		setCodeError(false);
		sendTestNotification.mutate({ ntfyTopic });
	};

	const handleVerifyCode = () => {
		if (verificationCode.length === 6) {
			verifyTestCode.mutate({ code: verificationCode });
		}
	};

	// Map current step to the appropriate component
	const getStepContent = () => {
		if (isFirstSubscription) {
			// Full onboarding: Download -> Subscribe -> Test -> Complete
			switch (currentStep) {
				case 0:
					return <StepDownload />;
				case 1:
					return (
						<StepSubscribe
							ntfyTopic={ntfyTopic}
							copied={copied}
							onCopy={copyToClipboard}
						/>
					);
				case 2:
					return (
						<StepTest
							onSendTest={handleSendTest}
							onVerify={handleVerifyCode}
							verificationCode={verificationCode}
							setVerificationCode={setVerificationCode}
							codeVerified={codeVerified}
							codeError={codeError}
							isSending={sendTestNotification.isPending}
							isVerifying={verifyTestCode.isPending}
							hasSentCode={sendTestNotification.isSuccess}
						/>
					);
				case 3:
					return <StepComplete isFirstSubscription={true} />;
				default:
					return null;
			}
		} else {
			// Test only: Subscribe -> Test -> Complete
			switch (currentStep) {
				case 0:
					return (
						<StepSubscribe
							ntfyTopic={ntfyTopic}
							copied={copied}
							onCopy={copyToClipboard}
							jpaName={jpaName}
						/>
					);
				case 1:
					return (
						<StepTest
							onSendTest={handleSendTest}
							onVerify={handleVerifyCode}
							verificationCode={verificationCode}
							setVerificationCode={setVerificationCode}
							codeVerified={codeVerified}
							codeError={codeError}
							isSending={sendTestNotification.isPending}
							isVerifying={verifyTestCode.isPending}
							hasSentCode={sendTestNotification.isSuccess}
						/>
					);
				case 2:
					return <StepComplete isFirstSubscription={false} jpaName={jpaName} />;
				default:
					return null;
			}
		}
	};

	const isTestStep = isFirstSubscription ? currentStep === 2 : currentStep === 1;
	const isLastStep = currentStep === steps.length - 1;

	return (
		<Modal
			open={open}
			onClose={handleSkip}
			size="lg"
			closeOnOverlayClick={false}
		>
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
				<ProgressSteps steps={steps} currentStep={currentStep} className="mt-6" />
			</ModalHeader>

			<ModalBody>{getStepContent()}</ModalBody>

			<ModalFooter>
				{currentStep > 0 && (
					<Button variant="secondary" onClick={handleBack}>
						Zurück
					</Button>
				)}
				{currentStep === 0 && (
					<Button variant="ghost" onClick={handleSkip}>
						{isFirstSubscription ? "Später einrichten" : "Überspringen"}
					</Button>
				)}
				<div className="flex-1" />
				{isTestStep && !codeVerified && (
					<Button variant="ghost" onClick={handleNext}>
						Überspringen
					</Button>
				)}
				{!isLastStep ? (
					<Button onClick={handleNext}>Weiter</Button>
				) : (
					<Button
						onClick={handleComplete}
						disabled={isFirstSubscription && completeOnboarding.isPending}
					>
						{isFirstSubscription && completeOnboarding.isPending ? (
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
		<div className="space-y-6">
			<div className="flex items-start gap-4">
				<div className="bg-nb-yellow p-3 border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
					<Download className="w-8 h-8" />
				</div>
				<div>
					<h3 className="text-lg font-black uppercase mb-2">
						1. ntfy App herunterladen
					</h3>
					<p className="font-medium">
						Die ntfy App ist kostenlos und ermöglicht dir, Push-Benachrichtigungen
						auf all deinen Geräten zu empfangen.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<a
					href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
					target="_blank"
					rel="noopener noreferrer"
					className="block"
				>
					<Card hover className="p-4 text-center">
						<Smartphone className="w-8 h-8 mx-auto mb-2" />
						<span className="font-bold text-sm uppercase">Android</span>
						<ExternalLink className="w-4 h-4 mx-auto mt-2" />
					</Card>
				</a>
				<a
					href="https://apps.apple.com/app/ntfy/id1625396347"
					target="_blank"
					rel="noopener noreferrer"
					className="block"
				>
					<Card hover className="p-4 text-center">
						<Smartphone className="w-8 h-8 mx-auto mb-2" />
						<span className="font-bold text-sm uppercase">iOS</span>
						<ExternalLink className="w-4 h-4 mx-auto mt-2" />
					</Card>
				</a>
				<a
					href="https://ntfy.sh"
					target="_blank"
					rel="noopener noreferrer"
					className="block"
				>
					<Card hover className="p-4 text-center">
						<Smartphone className="w-8 h-8 mx-auto mb-2" />
						<span className="font-bold text-sm uppercase">Web</span>
						<ExternalLink className="w-4 h-4 mx-auto mt-2" />
					</Card>
				</a>
			</div>

			<Card variant="muted" className="p-4">
				<p className="text-sm font-medium">
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
		<div className="space-y-6">
			<div className="flex items-start gap-4">
				<div className="bg-nb-teal p-3 border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
					<Smartphone className="w-8 h-8" />
				</div>
				<div>
					<h3 className="text-lg font-black uppercase mb-2">
						{jpaName ? `Kanal für ${jpaName} abonnieren` : "Deinen Kanal abonnieren"}
					</h3>
					<p className="font-medium">
						Öffne die ntfy App und abonniere deinen persönlichen Kanal.
					</p>
				</div>
			</div>

			<Card variant="primary" className="p-6">
				<p className="text-sm font-bold uppercase mb-3">Dein ntfy Kanal:</p>
				<div className="flex items-center gap-3">
					<code className="flex-1 bg-nb-white px-4 py-3 border-3 border-nb-black font-bold text-lg break-all">
						{ntfyTopic}
					</code>
					<Button variant="icon" size="icon" onClick={onCopy} title="Kopieren">
						{copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
					</Button>
				</div>
			</Card>

			<div className="space-y-3">
				<h4 className="font-black uppercase">So geht's:</h4>
				<ol className="space-y-2 font-medium">
					<li className="flex items-start gap-3">
						<span className="bg-nb-yellow px-2 py-0.5 border-2 border-nb-black font-black text-sm shrink-0">
							1
						</span>
						<span>Öffne die ntfy App</span>
					</li>
					<li className="flex items-start gap-3">
						<span className="bg-nb-yellow px-2 py-0.5 border-2 border-nb-black font-black text-sm shrink-0">
							2
						</span>
						<span>Tippe auf das + Symbol</span>
					</li>
					<li className="flex items-start gap-3">
						<span className="bg-nb-yellow px-2 py-0.5 border-2 border-nb-black font-black text-sm shrink-0">
							3
						</span>
						<span>Füge den kopierten Kanal-Namen ein</span>
					</li>
					<li className="flex items-start gap-3">
						<span className="bg-nb-yellow px-2 py-0.5 border-2 border-nb-black font-black text-sm shrink-0">
							4
						</span>
						<span>Tippe auf "Subscribe"</span>
					</li>
				</ol>
			</div>

			<Card variant="accent" className="p-4">
				<p className="text-sm font-medium">
					<strong>Tipp:</strong> Wiederhole diesen Schritt auf jedem Gerät, auf dem
					du Benachrichtigungen erhalten möchtest.
				</p>
			</Card>
		</div>
	);
}

function StepTest({
	onSendTest,
	onVerify,
	verificationCode,
	setVerificationCode,
	codeVerified,
	codeError,
	isSending,
	isVerifying,
	hasSentCode,
}: {
	onSendTest: () => void;
	onVerify: () => void;
	verificationCode: string;
	setVerificationCode: (code: string) => void;
	codeVerified: boolean;
	codeError: boolean;
	isSending: boolean;
	isVerifying: boolean;
	hasSentCode: boolean;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-start gap-4">
				<div className="bg-nb-coral p-3 border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
					<Send className="w-8 h-8" />
				</div>
				<div>
					<h3 className="text-lg font-black uppercase mb-2">
						Einrichtung testen
					</h3>
					<p className="font-medium">
						Lass uns prüfen, ob alles funktioniert. Wir senden dir eine
						Testbenachrichtigung mit einem Code.
					</p>
				</div>
			</div>

			{codeVerified ? (
				<Card variant="success" className="p-6 text-center">
					<div className="bg-nb-white w-16 h-16 border-4 border-nb-black mx-auto flex items-center justify-center mb-4">
						<Check className="w-8 h-8" />
					</div>
					<h4 className="font-black uppercase text-lg mb-2">Code bestätigt!</h4>
					<p className="font-medium">
						Deine Push-Benachrichtigungen sind eingerichtet.
					</p>
				</Card>
			) : (
				<>
					<div className="text-center">
						<Button
							onClick={onSendTest}
							disabled={isSending}
							variant="default"
							size="lg"
						>
							{isSending ? (
								<>
									<Loader2 className="w-5 h-5 animate-spin" />
									Sende...
								</>
							) : hasSentCode ? (
								<>
									<Send className="w-5 h-5" />
									Erneut senden
								</>
							) : (
								<>
									<Send className="w-5 h-5" />
									Test-Benachrichtigung senden
								</>
							)}
						</Button>
					</div>

					{hasSentCode && (
						<div className="space-y-4">
							<p className="text-center font-medium">
								Gib den 6-stelligen Code aus deiner Push-Benachrichtigung ein:
							</p>
							<CodeInput
								value={verificationCode}
								onChange={setVerificationCode}
								error={codeError}
								disabled={isVerifying}
							/>
							{codeError && (
								<p className="text-center text-sm font-bold text-nb-coral">
									Ungültiger oder abgelaufener Code. Bitte versuche es erneut.
								</p>
							)}
							<div className="text-center">
								<Button
									onClick={onVerify}
									disabled={verificationCode.length !== 6 || isVerifying}
									variant="success"
								>
									{isVerifying ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Prüfe...
										</>
									) : (
										"Code bestätigen"
									)}
								</Button>
							</div>
						</div>
					)}
				</>
			)}

			<Card variant="muted" className="p-4">
				<p className="text-sm font-medium">
					<strong>Keine Benachrichtigung erhalten?</strong> Stelle sicher, dass du
					den Kanal in der ntfy App abonniert hast und Benachrichtigungen
					aktiviert sind.
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
		<div className="text-center space-y-6">
			<div className="bg-nb-mint w-20 h-20 border-4 border-nb-black shadow-[var(--nb-shadow)] mx-auto flex items-center justify-center">
				<Check className="w-10 h-10" />
			</div>
			<div>
				<h3 className="text-2xl font-black uppercase mb-2">
					{isFirstSubscription ? "Alles eingerichtet!" : "Abonnement aktiv!"}
				</h3>
				<p className="font-medium max-w-md mx-auto">
					{isFirstSubscription
						? "Du erhältst jetzt Push-Benachrichtigungen, sobald neue Examensergebnisse veröffentlicht werden."
						: `Du erhältst jetzt Benachrichtigungen für ${jpaName || "dieses JPA"}.`}
				</p>
			</div>
			<Card variant="muted" className="p-4 text-left">
				<p className="text-sm font-medium">
					<strong>Hinweis:</strong> Du kannst deine ntfy Kanäle jederzeit im
					Dashboard einsehen und auf weiteren Geräten einrichten.
				</p>
			</Card>
		</div>
	);
}

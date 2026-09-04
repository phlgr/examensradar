import { ChevronDown, Loader2, MailCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { eyebrowClass } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface SignupFormProps {
	jpas: Array<{ id: string; name: string }> | undefined;
	loading: boolean;
	/** The office list failed to load — say so instead of a dead form. */
	error: boolean;
	/** Selected office; owned by the page so the preview can follow it. */
	jpaId: string;
	onJpaChange: (jpaId: string) => void;
}

const labelClass = cn(eyebrowClass, "block mb-1");

/**
 * The landing page's inline signup: pick an office, type an address, done.
 * Same procedure and same "we sent you a mail" promise as the modal on
 * /subscriptions — what actually happens is decided in the inbox.
 */
export function SignupForm({
	jpas,
	loading,
	error,
	jpaId,
	onJpaChange,
}: SignupFormProps) {
	const [email, setEmail] = useState("");
	const successRef = useRef<HTMLDivElement>(null);

	const jpaName = jpas?.find((jpa) => jpa.id === jpaId)?.name ?? "";

	const subscribe = trpc.email.subscribe.useMutation({
		onSuccess: () =>
			trackEvent("email_subscribe", { jpa: jpaName, source: "landing" }),
	});

	// The form (and the focused submit button) is replaced on success; move
	// focus onto the confirmation so keyboard and screen-reader users land on it.
	useEffect(() => {
		if (subscribe.isSuccess) successRef.current?.focus();
	}, [subscribe.isSuccess]);

	const canSubmit =
		jpaId !== "" &&
		email.includes("@") &&
		!subscribe.isPending &&
		!loading &&
		!error;

	if (subscribe.isSuccess) {
		return (
			<Card
				id="anmelden"
				ref={successRef}
				tabIndex={-1}
				role="status"
				variant="success"
				className="p-5 sm:p-6 flex gap-4 items-start focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
			>
				<IconBox color="white" shadow>
					<MailCheck className="w-6 h-6" />
				</IconBox>
				<div>
					<p className="font-black uppercase text-lg">Fast geschafft</p>
					<p className="font-medium text-sm mt-1">
						Wir haben eine E-Mail an <strong>{email}</strong> geschickt.
						Bestätige darin kurz deine Adresse – danach benachrichtigen wir
						dich, sobald {jpaName} neue Ergebnisse veröffentlicht.
					</p>
					<p className="text-xs font-medium mt-2 text-nb-black/60">
						Keine E-Mail bekommen? Schau in deinen Spam-Ordner oder versuch es
						einfach noch einmal.
					</p>
				</div>
			</Card>
		);
	}

	return (
		<Card className="p-4 sm:p-5">
			<form
				id="anmelden"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSubmit) subscribe.mutate({ email, jpaId });
				}}
			>
				<div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-x-0">
					<div className="sm:col-span-2">
						<label htmlFor="signup-jpa" className={labelClass}>
							Justizprüfungsamt
						</label>
						<span className="relative block">
							<select
								id="signup-jpa"
								value={jpaId}
								onChange={(event) => onJpaChange(event.target.value)}
								disabled={loading || error || !jpas?.length}
								className="h-12 w-full appearance-none bg-nb-white pl-4 pr-10 border-4 border-nb-black font-bold text-base focus:outline-none focus:bg-nb-cream disabled:opacity-50"
							>
								{loading && <option value="">Wird geladen …</option>}
								{error && <option value="">Nicht verfügbar</option>}
								{jpas?.map((jpa) => (
									<option key={jpa.id} value={jpa.id}>
										{jpa.name}
									</option>
								))}
							</select>
							<ChevronDown
								className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
								aria-hidden
							/>
						</span>
					</div>

					<div>
						<label htmlFor="signup-email" className={labelClass}>
							E-Mail-Adresse
						</label>
						<Input
							id="signup-email"
							type="email"
							autoComplete="email"
							required
							placeholder="name@beispiel.de"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>

					<div className="sm:self-end">
						<Button
							type="submit"
							disabled={!canSubmit}
							className="w-full sm:w-auto h-12 shadow-none sm:border-l-0 hover:translate-x-0 hover:translate-y-0 hover:bg-nb-black hover:text-nb-yellow"
						>
							{subscribe.isPending ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								"Benachrichtigen lassen"
							)}
						</Button>
					</div>
				</div>

				<p className="mt-3 text-xs font-medium text-nb-black/60">
					{error ? (
						<span role="alert" className="font-bold text-nb-coral">
							Die Prüfungsämter konnten nicht geladen werden. Bitte lade die
							Seite neu.
						</span>
					) : subscribe.isError ? (
						<span role="alert" className="font-bold text-nb-coral">
							Das hat leider nicht geklappt. Bitte versuch es noch einmal.
						</span>
					) : (
						"Kostenlos. Du bekommst nur dann eine E-Mail, wenn neue Ergebnisse da sind, und kannst jederzeit wieder abbestellen."
					)}
				</p>
			</form>
		</Card>
	);
}

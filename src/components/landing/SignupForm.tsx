import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

interface SignupFormProps {
	jpas: Array<{ id: string; name: string }> | undefined;
	loading: boolean;
	/** The office list failed to load — say so instead of a dead form. */
	error: boolean;
	/** Selected office; owned by the page so the preview can follow it. */
	jpaId: string;
	onJpaChange: (jpaId: string) => void;
}

const labelClass = "ui block text-[13px] text-ink/65 mb-1";
const fieldClass =
	"ui h-11 w-full rounded-[3px] bg-sheet border border-ink/30 px-3 text-[15px] text-ink placeholder:text-ink/35 hover:border-ink/50 focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_var(--mark)] disabled:opacity-50";

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
			<div
				id="anmelden"
				ref={successRef}
				tabIndex={-1}
				role="status"
				className="border-l-4 border-seal bg-sheet px-5 py-4"
			>
				<p className="headline text-xl">Fast geschafft.</p>
				<p className="text-[17px] text-ink/80 mt-1 leading-relaxed">
					Wir haben eine E-Mail an <strong>{email}</strong> geschickt. Bestätige
					darin kurz deine Adresse – danach benachrichtigen wir dich, sobald{" "}
					{jpaName} neue Ergebnisse veröffentlicht.
				</p>
				<p className="text-[15px] mt-2 text-ink/55">
					Keine E-Mail bekommen? Schau in deinen Spam-Ordner oder versuch es
					einfach noch einmal.
				</p>
			</div>
		);
	}

	return (
		<form
			id="anmelden"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSubmit) subscribe.mutate({ email, jpaId });
			}}
		>
			<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
							className={`${fieldClass} appearance-none pr-9 cursor-pointer`}
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
							className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink/60"
							aria-hidden
						/>
					</span>
				</div>

				<div>
					<label htmlFor="signup-email" className={labelClass}>
						E-Mail-Adresse
					</label>
					<input
						id="signup-email"
						type="email"
						autoComplete="email"
						required
						placeholder="name@beispiel.de"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						className={fieldClass}
					/>
				</div>

				<div className="sm:self-end">
					<button
						type="submit"
						disabled={!canSubmit}
						className="ui h-11 w-full sm:w-auto inline-flex items-center justify-center rounded-[3px] bg-seal px-5 text-[15px] font-semibold text-sheet hover:bg-seal-deep disabled:cursor-not-allowed disabled:bg-ink/20 cursor-pointer"
					>
						{subscribe.isPending ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							"Benachrichtigen lassen"
						)}
					</button>
				</div>
			</div>

			{error || subscribe.isError ? (
				<p role="alert" className="mt-3 text-[15px] text-seal">
					{error
						? "Die Prüfungsämter konnten nicht geladen werden. Bitte lade die Seite neu."
						: "Das hat leider nicht geklappt. Bitte versuch es noch einmal."}
				</p>
			) : (
				<p className="mt-3 text-[15px] text-ink/55 leading-snug">
					Kostenlos und ohne Konto. Du bekommst nur dann Post, wenn es Neues
					gibt, und kannst jederzeit abbestellen.
				</p>
			)}
		</form>
	);
}

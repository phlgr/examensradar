import { ArrowRight, ChevronDown, Loader2, MailCheck } from "lucide-react";
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

const labelClass = "block text-[13px] font-medium text-ink/60 mb-1.5";
const fieldClass =
	"h-12 w-full rounded-[12px] bg-paper/60 border border-ink/15 px-4 text-base text-ink transition-colors placeholder:text-ink/35 hover:border-ink/30 focus:outline-none focus:border-ink focus:bg-sheet focus:ring-4 focus:ring-mark/60 disabled:opacity-50";

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
				className="rounded-2xl bg-sheet ring-1 ring-ink/10 shadow-paper p-5 sm:p-6 flex gap-4 items-start"
			>
				<span className="w-11 h-11 shrink-0 rounded-full bg-mark grid place-items-center">
					<MailCheck className="w-5 h-5" />
				</span>
				<div>
					<p className="headline text-2xl leading-tight">Fast geschafft.</p>
					<p className="text-[15px] text-ink/75 mt-1.5 leading-relaxed">
						Wir haben eine E-Mail an{" "}
						<strong className="font-semibold text-ink">{email}</strong>{" "}
						geschickt. Bestätige darin kurz deine Adresse – danach
						benachrichtigen wir dich, sobald {jpaName} neue Ergebnisse
						veröffentlicht.
					</p>
					<p className="text-[13px] mt-3 text-ink/50">
						Keine E-Mail bekommen? Schau in deinen Spam-Ordner oder versuch es
						einfach noch einmal.
					</p>
				</div>
			</div>
		);
	}

	return (
		<form
			id="anmelden"
			className="rounded-2xl bg-sheet ring-1 ring-ink/10 shadow-paper p-4 sm:p-5"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSubmit) subscribe.mutate({ email, jpaId });
			}}
		>
			<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
				<div className="sm:col-span-2">
					<label htmlFor="signup-jpa" className={labelClass}>
						Dein Justizprüfungsamt
					</label>
					<span className="relative block">
						<select
							id="signup-jpa"
							value={jpaId}
							onChange={(event) => onJpaChange(event.target.value)}
							disabled={loading || error || !jpas?.length}
							className={`${fieldClass} appearance-none pr-10 font-medium cursor-pointer`}
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
							className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50"
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
						className="group h-12 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[12px] bg-ink px-5 text-[15px] font-semibold text-sheet shadow-[inset_0_-2px_0_rgb(0_0_0/0.35)] transition-colors hover:bg-seal disabled:cursor-not-allowed disabled:bg-ink/25 disabled:shadow-none cursor-pointer"
					>
						{subscribe.isPending ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							<>
								Benachrichtigen lassen
								<ArrowRight className="w-4 h-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
							</>
						)}
					</button>
				</div>
			</div>

			{error || subscribe.isError ? (
				<p role="alert" className="mt-4 text-sm font-medium text-seal">
					{error
						? "Die Prüfungsämter konnten nicht geladen werden. Bitte lade die Seite neu."
						: "Das hat leider nicht geklappt. Bitte versuch es noch einmal."}
				</p>
			) : (
				<p className="mt-4 text-[13px] text-ink/60 leading-relaxed">
					Kostenlos und ohne Konto. Du bekommst nur Post, wenn es Neues gibt,
					und kannst jederzeit abbestellen.
				</p>
			)}
		</form>
	);
}

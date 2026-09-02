import { ChevronDown, Loader2, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

interface SignupFormProps {
	jpas: Array<{ id: string; name: string }> | undefined;
	loading: boolean;
}

/**
 * The landing page's inline signup: pick an office, type an address, done.
 * Same procedure and same "we sent you a mail" promise as the modal on
 * /subscriptions — what actually happens is decided in the inbox.
 */
export function SignupForm({ jpas, loading }: SignupFormProps) {
	const [jpaId, setJpaId] = useState("");
	const [email, setEmail] = useState("");

	// Preselect the first office once the list is in, so a single-office
	// deployment needs no extra click.
	useEffect(() => {
		if (!jpaId && jpas?.[0]) setJpaId(jpas[0].id);
	}, [jpas, jpaId]);

	const jpaName = jpas?.find((jpa) => jpa.id === jpaId)?.name ?? "";

	const subscribe = trpc.email.subscribe.useMutation({
		onSuccess: () =>
			trackEvent("email_subscribe", { jpa: jpaName, source: "landing" }),
	});

	const canSubmit =
		jpaId !== "" && email.includes("@") && !subscribe.isPending && !loading;

	if (subscribe.isSuccess) {
		return (
			<div
				id="anmelden"
				className="bg-nb-mint border-4 border-nb-black shadow-[var(--nb-shadow)] p-5 sm:p-6 flex gap-4 items-start"
			>
				<div className="bg-nb-white border-3 border-nb-black p-2 shrink-0 shadow-[var(--nb-shadow-sm)]">
					<MailCheck className="w-6 h-6" />
				</div>
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
			</div>
		);
	}

	return (
		<form
			id="anmelden"
			className="bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)] p-4 sm:p-5"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSubmit) subscribe.mutate({ email, jpaId });
			}}
		>
			<div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-x-0">
				<div className="sm:col-span-2">
					<label
						htmlFor="signup-jpa"
						className="block text-[11px] font-black uppercase tracking-wider mb-1"
					>
						Justizprüfungsamt
					</label>
					<span className="relative block">
						<select
							id="signup-jpa"
							value={jpaId}
							onChange={(event) => setJpaId(event.target.value)}
							disabled={loading || !jpas?.length}
							className="h-12 w-full appearance-none bg-nb-white pl-4 pr-10 border-4 border-nb-black font-bold text-base focus:outline-none focus:bg-nb-cream disabled:opacity-50"
						>
							{loading && <option value="">Wird geladen …</option>}
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
					<label
						htmlFor="signup-email"
						className="block text-[11px] font-black uppercase tracking-wider mb-1"
					>
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
				{subscribe.isError ? (
					<span className="font-bold text-nb-coral">
						Das hat leider nicht geklappt. Bitte versuch es noch einmal.
					</span>
				) : (
					"Kostenlos. Du bekommst nur dann eine E-Mail, wenn neue Ergebnisse da sind, und kannst dich jederzeit abmelden."
				)}
			</p>
		</form>
	);
}

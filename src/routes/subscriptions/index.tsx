import { createFileRoute } from "@tanstack/react-router";
import {
	CheckCircle,
	ExternalLink,
	History,
	Loader2,
	LogOut,
	Mail,
	MailCheck,
	Radar,
	Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EmailSignupModal } from "@/components/email/EmailSignupModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { trackEvent } from "@/lib/analytics";
import { setDeviceId } from "@/lib/device-id";
import { trpc } from "@/lib/trpc";

const searchSchema = z.object({
	/** Legacy ntfy device restore from old push notifications. */
	restore: z.uuid().optional(),
	/** Manage token from mail links; exchanged for the httpOnly cookie. */
	manage: z.string().min(16).max(64).optional(),
});

export const Route = createFileRoute("/subscriptions/")({
	validateSearch: searchSchema,
	component: SubscriptionsPage,
});

const RESTORED_FLAG = "examensradar_restored";
const INVALID_LINK_FLAG = "examensradar_link_invalid";

function SubscriptionsPage() {
	const { restore, manage } = Route.useSearch();
	const [showRestoredBanner, setShowRestoredBanner] = useState(false);
	const [showInvalidLink, setShowInvalidLink] = useState(false);
	const [signupJpa, setSignupJpa] = useState<{
		id: string;
		name: string;
	} | null>(null);

	// Legacy: restore parameter from old ntfy notification actions.
	useEffect(() => {
		if (restore) {
			setDeviceId(restore);
			sessionStorage.setItem(RESTORED_FLAG, "true");
			// location.replace scrubs the credential from the URL atomically.
			window.location.replace("/subscriptions");
		}
	}, [restore]);

	// Manage token from a mail link: trade it for the httpOnly cookie, then
	// scrub it from the URL the same way the restore param is scrubbed.
	const signIn = trpc.email.signIn.useMutation();
	// signIn.mutate is stable; the token is the only real trigger.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per token
	useEffect(() => {
		if (!manage) return;
		signIn.mutate(
			{ token: manage },
			{
				onError: () => sessionStorage.setItem(INVALID_LINK_FLAG, "true"),
				onSettled: () => window.location.replace("/subscriptions"),
			},
		);
	}, [manage]);

	useEffect(() => {
		if (sessionStorage.getItem(RESTORED_FLAG)) {
			setShowRestoredBanner(true);
			sessionStorage.removeItem(RESTORED_FLAG);
		}
		if (sessionStorage.getItem(INVALID_LINK_FLAG)) {
			setShowInvalidLink(true);
			sessionStorage.removeItem(INVALID_LINK_FLAG);
		}
	}, []);

	const utils = trpc.useUtils();
	const jpasQuery = trpc.jpa.getAll.useQuery();
	// UNAUTHORIZED simply means "not signed in", so never retry it.
	const meQuery = trpc.email.me.useQuery(undefined, { retry: false });
	const ntfySubscriptionsQuery = trpc.subscription.getAll.useQuery();

	const addJpa = trpc.email.addJpa.useMutation({
		onSuccess: () => {
			trackEvent("email_add_jpa");
			utils.email.me.invalidate();
		},
	});

	const removeJpa = trpc.email.removeJpa.useMutation({
		onSuccess: () => {
			trackEvent("email_remove_jpa");
			utils.email.me.invalidate();
		},
	});

	const deleteNtfySubscription = trpc.subscription.delete.useMutation({
		onSuccess: () => {
			trackEvent("unsubscribe");
			ntfySubscriptionsQuery.refetch();
		},
	});

	const signOut = trpc.email.signOut.useMutation({
		onSuccess: () => window.location.reload(),
	});

	// Exchanging a token or restoring — hold the spinner until the reload.
	const exchanging = Boolean(restore || manage);
	const loading = jpasQuery.isLoading || meQuery.isLoading || exchanging;

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	const jpas = jpasQuery.data ?? [];
	const me = meQuery.data ?? null;
	const managing = me !== null && !me.unsubscribed;
	const subscribedJpaIds = new Set(
		managing ? me.jpas.map((jpa) => jpa.jpaId) : [],
	);
	const ntfySubscriptions = ntfySubscriptionsQuery.data ?? [];

	return (
		<div className="min-h-screen py-4 sm:py-8 px-4 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6 sm:mb-8">
					<h1 className="text-3xl sm:text-4xl font-black uppercase mb-2">
						Benachrichtigungen
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Erhalte eine E-Mail, sobald dein Prüfungsamt neue Examensergebnisse
						veröffentlicht — keine App, kein Konto.
					</p>
				</div>

				{/* History Teaser */}
				<Card variant="flat" className="mb-6 sm:mb-8 p-3 sm:p-4">
					<div className="flex flex-wrap items-center gap-3">
						<div className="w-9 h-9 bg-nb-yellow border-3 border-nb-black flex items-center justify-center shrink-0">
							<History className="w-4 h-4" />
						</div>
						<p className="text-sm font-medium flex-1 min-w-0">
							<span className="font-black">Wann veröffentlicht dein JPA?</span>{" "}
							Sieh dir die Ergebnis-Historie mit typischem Tag und Uhrzeit an.
						</p>
						<LinkButton to="/history" size="sm" className="w-full sm:w-auto">
							Zur Historie
						</LinkButton>
					</div>
				</Card>

				{/* Invalid manage link */}
				{showInvalidLink && (
					<Card variant="destructive" className="mb-6 sm:mb-8 p-4">
						<p className="font-black text-sm uppercase">
							Dieser Verwaltungslink ist nicht mehr gültig
						</p>
						<p className="text-xs font-medium mt-1">
							Lass dir unten mit deiner E-Mail-Adresse einen neuen Link
							schicken.
						</p>
					</Card>
				)}

				{/* Legacy device restore banner */}
				{showRestoredBanner && (
					<Card variant="success" className="mb-6 sm:mb-8 p-4">
						<div className="flex items-center gap-3">
							<div className="bg-nb-mint p-2 border-3 border-nb-black shrink-0">
								<CheckCircle className="w-5 h-5" />
							</div>
							<div className="flex-1">
								<p className="font-black text-sm uppercase">
									Abonnements wiederhergestellt
								</p>
								<p className="text-xs font-medium">
									Deine Abonnements wurden erfolgreich auf dieses Gerät
									übertragen.
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowRestoredBanner(false)}
								className="shrink-0"
							>
								Schließen
							</Button>
						</div>
					</Card>
				)}

				{/* Signed-in header */}
				{managing && (
					<Card variant="primary" className="mb-6 sm:mb-8 p-4">
						<div className="flex flex-wrap items-center gap-3">
							<div className="bg-nb-white p-2 border-3 border-nb-black shrink-0">
								<MailCheck className="w-5 h-5" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="font-black text-sm uppercase">Angemeldet</p>
								<p className="text-xs sm:text-sm font-medium break-all">
									{me.email}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => signOut.mutate()}
								disabled={signOut.isPending}
								className="shrink-0 gap-1.5"
							>
								<LogOut className="w-4 h-4" />
								Auf diesem Gerät abmelden
							</Button>
						</div>
					</Card>
				)}

				{/* Previously unsubscribed */}
				{me?.unsubscribed && (
					<Card variant="muted" className="mb-6 sm:mb-8 p-4">
						<p className="font-black text-sm uppercase">
							Du bist von allen E-Mails abgemeldet
						</p>
						<p className="text-xs font-medium mt-1">
							Wenn du wieder benachrichtigt werden möchtest, abonniere unten
							einfach neu — wir schicken dir dann einen Bestätigungslink.
						</p>
					</Card>
				)}

				{/* JPA List */}
				<div className="space-y-4">
					<h2 className="text-xl sm:text-2xl font-black uppercase">
						Justizprüfungsämter
					</h2>

					{jpas.length === 0 ? (
						<Card className="p-8 text-center">
							<div className="w-16 h-16 bg-nb-yellow border-4 border-nb-black flex items-center justify-center mx-auto mb-4">
								<Radar className="w-8 h-8" />
							</div>
							<p className="font-bold">
								Noch keine Justizprüfungsämter verfügbar.
							</p>
						</Card>
					) : (
						<div className="grid gap-4">
							{jpas.map((jpa) => {
								const isSubscribed = subscribedJpaIds.has(jpa.id);
								const isMutating =
									(addJpa.isPending && addJpa.variables?.jpaId === jpa.id) ||
									(removeJpa.isPending &&
										removeJpa.variables?.jpaId === jpa.id);

								return (
									<Card
										key={jpa.id}
										variant={isSubscribed ? "success" : "default"}
										className="p-4 sm:p-6"
									>
										<div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
													<h3 className="text-lg sm:text-xl font-black uppercase">
														{jpa.name}
													</h3>
													{isSubscribed && <Badge>Abonniert</Badge>}
												</div>
												{jpa.websiteUrl && (
													<a
														href={jpa.websiteUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-xs sm:text-sm font-bold inline-flex items-center gap-1 underline decoration-2 hover:bg-nb-yellow transition-colors cursor-pointer"
													>
														Zur Website
														<ExternalLink className="w-3 h-3" />
													</a>
												)}
											</div>

											{managing ? (
												<Button
													onClick={() =>
														isSubscribed
															? removeJpa.mutate({ jpaId: jpa.id })
															: addJpa.mutate({ jpaId: jpa.id })
													}
													variant={isSubscribed ? "destructive" : "default"}
													disabled={isMutating}
													className="shrink-0 w-full sm:w-auto"
													size="sm"
												>
													{isMutating ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : isSubscribed ? (
														"Abbestellen"
													) : (
														"Abonnieren"
													)}
												</Button>
											) : (
												<Button
													onClick={() =>
														setSignupJpa({ id: jpa.id, name: jpa.name })
													}
													className="shrink-0 w-full sm:w-auto gap-1.5"
													size="sm"
												>
													<Mail className="w-4 h-4" />
													Abonnieren
												</Button>
											)}
										</div>
									</Card>
								);
							})}
						</div>
					)}
				</div>

				{/* Lost-link re-entry */}
				{!managing && <ResendManageLinkCard />}

				{/* Legacy ntfy subscriptions */}
				{ntfySubscriptions.length > 0 && (
					<div className="mt-8 sm:mt-10 space-y-4">
						<h2 className="text-xl sm:text-2xl font-black uppercase">
							Push-Benachrichtigungen (Legacy)
						</h2>
						<Card variant="muted" className="p-4">
							<div className="flex items-start gap-3">
								<div className="bg-nb-white p-2 border-3 border-nb-black shrink-0">
									<Smartphone className="w-5 h-5" />
								</div>
								<p className="text-xs sm:text-sm font-medium flex-1">
									<span className="font-black">
										Push über ntfy wird in Kürze eingestellt.
									</span>{" "}
									Abonniere dein Prüfungsamt oben per E-Mail, um weiterhin
									benachrichtigt zu werden. Bestehende Push-Abos funktionieren
									bis zur Abschaltung weiter.
								</p>
							</div>
						</Card>
						<div className="grid gap-3">
							{ntfySubscriptions.map((subscription) => {
								const jpa = jpas.find((j) => j.id === subscription.jpaId);
								return (
									<Card key={subscription.id} variant="flat" className="p-4">
										<div className="flex flex-wrap items-center gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-black text-sm uppercase">
													{jpa?.name ?? "Prüfungsamt"}
												</p>
												<code className="text-xs font-bold break-all text-nb-black/60">
													{subscription.ntfyTopic}
												</code>
											</div>
											<Button
												variant="destructive"
												size="sm"
												onClick={() =>
													deleteNtfySubscription.mutate({
														id: subscription.id,
													})
												}
												disabled={deleteNtfySubscription.isPending}
												className="shrink-0"
											>
												Abbestellen
											</Button>
										</div>
									</Card>
								);
							})}
						</div>
					</div>
				)}

				{/* Signup modal */}
				{signupJpa && (
					<EmailSignupModal
						open={signupJpa !== null}
						onClose={() => setSignupJpa(null)}
						jpaId={signupJpa.id}
						jpaName={signupJpa.name}
					/>
				)}
			</div>
		</div>
	);
}

/**
 * The way back in for a lost manage link. The reply is deliberately identical
 * whether the address is known or not, so the copy promises a mail only "if
 * you are subscribed".
 */
function ResendManageLinkCard() {
	const [email, setEmail] = useState("");
	const resend = trpc.email.resendManageLink.useMutation();

	const canSubmit = email.includes("@") && !resend.isPending;

	return (
		<Card variant="flat" className="mt-8 sm:mt-10 p-4 sm:p-6">
			<div className="flex items-start gap-3 sm:gap-4">
				<div className="bg-nb-teal p-2 border-3 border-nb-black shrink-0">
					<Mail className="w-5 h-5" />
				</div>
				<div className="flex-1 min-w-0">
					<h2 className="font-black text-sm sm:text-base uppercase mb-1">
						Bereits angemeldet?
					</h2>
					{resend.isSuccess ? (
						<p className="text-xs sm:text-sm font-medium">
							Wenn diese Adresse angemeldet ist, findest du gleich eine E-Mail
							mit deinem Verwaltungslink im Postfach.
						</p>
					) : (
						<>
							<p className="text-xs sm:text-sm font-medium mb-3">
								Wir schicken dir deinen Verwaltungslink erneut zu.
							</p>
							<form
								className="flex flex-col sm:flex-row gap-2 sm:gap-3"
								onSubmit={(event) => {
									event.preventDefault();
									if (canSubmit) resend.mutate({ email });
								}}
							>
								<Input
									type="email"
									autoComplete="email"
									placeholder="deine@email.de"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									className="h-10 text-sm sm:max-w-xs"
								/>
								<Button type="submit" size="sm" disabled={!canSubmit}>
									{resend.isPending ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										"Link senden"
									)}
								</Button>
							</form>
						</>
					)}
				</div>
			</div>
		</Card>
	);
}

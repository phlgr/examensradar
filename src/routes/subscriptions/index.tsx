import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarClock,
	CheckCircle,
	ExternalLink,
	Loader2,
	LogOut,
	Mail,
	MailCheck,
	Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EmailSignupModal } from "@/components/email/EmailSignupModal";
import {
	JpaSearchEmpty,
	JpaSearchInput,
	useJpaSearch,
} from "@/components/jpa-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";
import { Input } from "@/components/ui/input";
import { PageSpinner } from "@/components/ui/spinner";
import { TeaserCard } from "@/components/ui/teaser-card";
import { trackEvent } from "@/lib/analytics";
import { setDeviceId } from "@/lib/device-id";
import { summarizeReleases } from "@/lib/release-summary";
import { trpc } from "@/lib/trpc";

// Neither param may make validateSearch throw: mail clients truncate links,
// and a throw here replaces the whole page with the raw router error instead
// of the invalid-link banner. `.catch(undefined)` turns anything malformed
// into "param absent".
const searchSchema = z.object({
	/** Legacy ntfy device restore from old push notifications. */
	restore: z.uuid().optional().catch(undefined),
	/**
	 * Manage token from mail links; exchanged for the httpOnly cookie. No shape
	 * check: a mangled token must still reach signIn, whose rejection is what
	 * shows the invalid-link banner.
	 */
	manage: z.string().optional().catch(undefined),
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
	const historyQuery = trpc.jpa.getHistory.useQuery();
	// UNAUTHORIZED simply means "not signed in", so never retry it.
	const meQuery = trpc.email.me.useQuery(undefined, { retry: false });
	const ntfySubscriptionsQuery = trpc.subscription.getAll.useQuery();

	const jpas = jpasQuery.data ?? [];
	const search = useJpaSearch(jpas);

	const jpaNameById = (id: string) =>
		jpas.find((jpa) => jpa.id === id)?.name ?? id;

	const addJpa = trpc.email.addJpa.useMutation({
		onSuccess: (_data, variables) => {
			trackEvent("email_add_jpa", { jpa: jpaNameById(variables.jpaId) });
			utils.email.me.invalidate();
		},
	});

	const removeJpa = trpc.email.removeJpa.useMutation({
		onSuccess: (_data, variables) => {
			trackEvent("email_remove_jpa", { jpa: jpaNameById(variables.jpaId) });
			utils.email.me.invalidate();
		},
	});

	const signOut = trpc.email.signOut.useMutation({
		onSuccess: () => window.location.reload(),
	});

	const deleteNtfySubscription = trpc.subscription.delete.useMutation({
		onSuccess: () => {
			trackEvent("unsubscribe");
			ntfySubscriptionsQuery.refetch();
		},
	});

	// Exchanging a token or restoring — hold the spinner until the reload.
	const exchanging = Boolean(restore || manage);
	if (jpasQuery.isLoading || meQuery.isLoading || exchanging) {
		return <PageSpinner />;
	}

	const me = meQuery.data ?? null;
	const managing = me !== null && !me.unsubscribed;
	const subscribedJpaIds = new Set(
		managing ? me.jpas.map((jpa) => jpa.jpaId) : [],
	);
	const ntfySubscriptions = ntfySubscriptionsQuery.data ?? [];
	const summaryBySlug = new Map(
		summarizeReleases(historyQuery.data ?? [], new Date()).map((summary) => [
			summary.slug,
			summary,
		]),
	);

	return (
		<div className="flex-1 py-8 sm:py-12 px-4 sm:px-6 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<SectionIntro
					as="h1"
					title={managing ? "Deine Benachrichtigungen" : "Benachrichtigungen"}
					className="mb-8 sm:mb-10"
					textClassName="max-w-2xl"
				>
					{managing
						? "Wähle aus, über welche Prüfungsämter du informiert werden möchtest. Sobald eines davon neue Ergebnisse veröffentlicht, bekommst du eine E-Mail."
						: "Abonniere dein Justizprüfungsamt und bekomme eine E-Mail, sobald es neue Examensergebnisse veröffentlicht."}
				</SectionIntro>

				{/* Invalid manage link */}
				{showInvalidLink && (
					<Card variant="destructive" className="mb-6 sm:mb-8 p-4 sm:p-5">
						<p className="font-black text-sm uppercase">
							Dieser Link ist nicht mehr gültig
						</p>
						<p className="text-sm font-medium mt-1">
							Gib unten deine E-Mail-Adresse ein – wir schicken dir einen neuen
							Link zu deinen Einstellungen.
						</p>
					</Card>
				)}

				{/* Legacy device restore banner */}
				{showRestoredBanner && (
					<Card variant="success" className="mb-6 sm:mb-8 p-4 sm:p-5">
						<div className="flex items-center gap-3">
							<IconBox color="white">
								<CheckCircle className="w-5 h-5" />
							</IconBox>
							<div className="flex-1">
								<p className="font-black text-sm uppercase">
									Push-Benachrichtigungen wiederhergestellt
								</p>
								<p className="text-sm font-medium">
									Deine Push-Benachrichtigungen sind jetzt auf diesem Gerät
									aktiv.
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
					<Card variant="primary" className="mb-6 sm:mb-8 p-4 sm:p-5">
						<div className="flex flex-wrap items-center gap-3">
							<IconBox color="white">
								<MailCheck className="w-5 h-5" />
							</IconBox>
							<div className="flex-1 min-w-0">
								<Eyebrow muted={false}>Angemeldet als</Eyebrow>
								<p className="text-sm sm:text-base font-bold break-all">
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
								Abmelden
							</Button>
						</div>
					</Card>
				)}

				{/* Previously unsubscribed */}
				{me?.unsubscribed && (
					<Card variant="muted" className="mb-6 sm:mb-8 p-4 sm:p-5">
						<p className="font-black text-sm uppercase">
							Du erhältst derzeit keine E-Mails
						</p>
						<p className="text-sm font-medium mt-1">
							Du hast dich von allen Benachrichtigungen abgemeldet. Wenn du
							wieder informiert werden möchtest, abonniere ein Prüfungsamt
							einfach erneut – wir schicken dir dann einen neuen
							Bestätigungslink.
						</p>
					</Card>
				)}

				{/* JPA list */}
				<section className="space-y-4">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<h2 className="text-xl sm:text-2xl font-black uppercase">
							Justizprüfungsämter
						</h2>
						{search.searchable && (
							<JpaSearchInput
								value={search.search}
								onChange={search.setSearch}
							/>
						)}
					</div>

					{jpas.length === 0 ? (
						<Card className="p-8 text-center">
							<p className="font-bold">
								Derzeit sind keine Prüfungsämter hinterlegt.
							</p>
						</Card>
					) : search.empty ? (
						<JpaSearchEmpty query={search.search} />
					) : (
						<div className="grid gap-4">
							{search.visible.map((jpa) => {
								const isSubscribed = subscribedJpaIds.has(jpa.id);
								const isMutating =
									(addJpa.isPending && addJpa.variables?.jpaId === jpa.id) ||
									(removeJpa.isPending &&
										removeJpa.variables?.jpaId === jpa.id);
								const summary = summaryBySlug.get(jpa.slug);

								return (
									<Card
										key={jpa.id}
										variant={isSubscribed ? "success" : "default"}
										className="p-4 sm:p-6"
									>
										<div className="flex flex-col sm:flex-row sm:items-center gap-4">
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-3 flex-wrap">
													<h3 className="text-lg sm:text-xl font-black uppercase leading-tight">
														{jpa.name}
													</h3>
													{isSubscribed && <Badge>Aktiv</Badge>}
												</div>
												{summary?.prediction && summary.daysUntil !== null && (
													<p className="mt-1.5 flex items-center gap-1.5">
														<CalendarClock className="w-4 h-4 shrink-0 text-nb-black/50" />
														<PredictionNote
															prediction={summary.prediction}
															daysUntil={summary.daysUntil}
															prefix="Nächste Veröffentlichung voraussichtlich am"
															className="font-medium"
														/>
													</p>
												)}
												{jpa.websiteUrl && (
													<a
														href={jpa.websiteUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="mt-2 text-xs font-bold uppercase inline-flex items-center gap-1 underline decoration-2 underline-offset-4 hover:bg-nb-yellow transition-colors"
													>
														Website des Prüfungsamts
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
													variant={isSubscribed ? "secondary" : "default"}
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
				</section>

				{/* Lost-link re-entry */}
				{!managing && <ResendManageLinkCard />}

				<TeaserCard
					icon={CalendarClock}
					title="Wann ist es so weit?"
					to="/history"
					action="Zur Historie"
					className="mt-8 sm:mt-10"
				>
					In der Historie siehst du, wann die Prüfungsämter bisher
					veröffentlicht haben – und wann die nächsten Ergebnisse
					voraussichtlich kommen.
				</TeaserCard>

				{/* Legacy ntfy subscriptions */}
				{ntfySubscriptions.length > 0 && (
					<section className="mt-8 sm:mt-10 space-y-4">
						<h2 className="text-xl sm:text-2xl font-black uppercase">
							Push-Benachrichtigungen (ntfy)
						</h2>
						<Card variant="muted" className="p-4 sm:p-5">
							<div className="flex flex-col sm:flex-row items-start gap-3">
								<IconBox color="white">
									<Smartphone className="w-5 h-5" />
								</IconBox>
								<p className="text-sm font-medium flex-1 w-full">
									<span className="font-black">
										Die Push-Benachrichtigungen über ntfy werden zum 15.
										September 2026 eingestellt.
									</span>{" "}
									Damit du weiterhin informiert wirst, abonniere dein
									Prüfungsamt oben per E-Mail. Bis dahin funktionieren deine
									bestehenden Push-Abos weiter.
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
												variant="secondary"
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
					</section>
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
			<div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
				<IconBox color="teal">
					<Mail className="w-5 h-5" />
				</IconBox>
				<div className="flex-1 min-w-0 w-full">
					<h2 className="font-black text-base uppercase mb-1">
						Schon angemeldet?
					</h2>
					{resend.isSuccess ? (
						<p className="text-sm font-medium">
							Falls diese Adresse bei uns angemeldet ist, findest du den Link zu
							deinen Einstellungen gleich in deinem Postfach.
						</p>
					) : (
						<>
							<p className="text-sm font-medium mb-3">
								Gib deine E-Mail-Adresse ein, und wir schicken dir den Link zu
								deinen Einstellungen noch einmal zu.
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
									placeholder="name@beispiel.de"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									className="h-10 text-sm sm:max-w-xs"
								/>
								<Button type="submit" size="sm" disabled={!canSubmit}>
									{resend.isPending ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										"Link zuschicken"
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

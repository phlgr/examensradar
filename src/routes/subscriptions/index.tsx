import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
	JpaSearchEmpty,
	JpaSearchInput,
	useJpaSearch,
} from "@/components/jpa-search";
import { SignupForm } from "@/components/SignupForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { PageSpinner } from "@/components/ui/spinner";
import { trackEvent } from "@/lib/analytics";
import { summarizeReleases } from "@/lib/release-summary";
import { noindex } from "@/lib/seo";
import { trpc } from "@/lib/trpc";

// The param must not make validateSearch throw: mail clients truncate links,
// and a throw here replaces the whole page with the raw router error instead
// of the invalid-link banner.
const searchSchema = z.object({
	manage: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/subscriptions/")({
	head: () => ({
		meta: [{ title: "Benachrichtigungen verwalten | Examensradar" }, noindex],
	}),
	validateSearch: searchSchema,
	component: SubscriptionsPage,
});

const INVALID_LINK_FLAG = "examensradar_link_invalid";

function SubscriptionsPage() {
	const { manage } = Route.useSearch();
	const [showInvalidLink, setShowInvalidLink] = useState(false);

	const { mutate: signIn } = trpc.email.signIn.useMutation();
	useEffect(() => {
		if (!manage) return;
		signIn(
			{ token: manage },
			{
				onError: () => sessionStorage.setItem(INVALID_LINK_FLAG, "true"),
				onSettled: () => window.location.replace("/subscriptions"),
			},
		);
	}, [manage, signIn]);

	useEffect(() => {
		if (sessionStorage.getItem(INVALID_LINK_FLAG)) {
			setShowInvalidLink(true);
			sessionStorage.removeItem(INVALID_LINK_FLAG);
		}
	}, []);

	const meQuery = trpc.email.me.useQuery(undefined, { retry: false });

	if (meQuery.isLoading || manage) return <PageSpinner />;

	const me = meQuery.data ?? null;

	return (
		<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
			<div className="max-w-4xl mx-auto">
				<SectionIntro
					as="h1"
					title={
						me && !me.unsubscribed
							? "Deine Benachrichtigungen"
							: "Benachrichtigungen"
					}
					className="mb-10 sm:mb-14"
				>
					{me === null
						? "Wir schicken dir eine E-Mail, sobald dein Prüfungsamt neue Ergebnisse veröffentlicht."
						: me.unsubscribed
							? "Du hast alle Benachrichtigungen abbestellt. Wenn du wieder informiert werden möchtest, melde dich hier einfach neu an."
							: "Wähle aus, über welche Prüfungsämter du informiert werden möchtest. Sobald eines davon neue Ergebnisse veröffentlicht, bekommst du eine E-Mail."}
				</SectionIntro>

				{showInvalidLink && (
					<Card variant="destructive" className="mb-8 p-5">
						<p className="font-semibold">Dieser Link ist nicht mehr gültig.</p>
						<p className="text-[15px] text-ink/70 mt-1">
							Unten bei „Schon angemeldet?“ schicken wir dir einen neuen Link zu
							deinen Einstellungen.
						</p>
					</Card>
				)}

				{me === null || me.unsubscribed ? (
					<Signup signedOut={me === null} />
				) : (
					<Managing email={me.email} jpaIds={me.jpas.map((jpa) => jpa.jpaId)} />
				)}
			</div>
		</div>
	);
}

function Managing({ email, jpaIds }: { email: string; jpaIds: string[] }) {
	const utils = trpc.useUtils();
	const jpasQuery = trpc.jpa.getAll.useQuery();
	const historyQuery = trpc.jpa.getHistory.useQuery();

	const jpas = jpasQuery.data ?? [];
	const search = useJpaSearch(jpas);
	const subscribedJpaIds = new Set(jpaIds);
	const summaryBySlug = new Map(
		summarizeReleases(historyQuery.data ?? [], new Date()).map((summary) => [
			summary.slug,
			summary,
		]),
	);

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

	if (jpasQuery.isLoading) return <PageSpinner />;

	return (
		<>
			<Card className="mb-10 px-5 py-4 flex flex-wrap items-center gap-3">
				<div className="flex-1 min-w-0">
					<Eyebrow>Angemeldet als</Eyebrow>
					<p className="font-semibold break-all">{email}</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => signOut.mutate()}
					disabled={signOut.isPending}
					className="shrink-0"
				>
					<LogOut className="w-4 h-4" />
					Ausloggen
				</Button>
			</Card>

			<section>
				<div className="flex flex-wrap items-end justify-between gap-4 mb-5">
					<h2 className="text-2xl font-semibold leading-tight">
						Justizprüfungsämter
					</h2>
					{search.searchable && (
						<JpaSearchInput value={search.search} onChange={search.setSearch} />
					)}
				</div>

				{jpas.length === 0 ? (
					<Card className="p-8 text-center">
						<p className="text-ink/70">
							Derzeit sind keine Prüfungsämter hinterlegt.
						</p>
					</Card>
				) : search.empty ? (
					<JpaSearchEmpty query={search.search} />
				) : (
					<div className="space-y-3">
						{search.visible.map((jpa) => {
							const isSubscribed = subscribedJpaIds.has(jpa.id);
							const isMutating =
								(addJpa.isPending && addJpa.variables?.jpaId === jpa.id) ||
								(removeJpa.isPending && removeJpa.variables?.jpaId === jpa.id);
							const summary = summaryBySlug.get(jpa.slug);

							return (
								<Card key={jpa.id} className="px-5 py-5 sm:px-6">
									<div className="flex flex-col sm:flex-row sm:items-center gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-3 flex-wrap">
												<h3 className="text-lg font-semibold leading-tight">
													{jpa.name}
												</h3>
												{isSubscribed && <Badge>Aktiv</Badge>}
											</div>
											{summary?.prediction && summary.daysUntil !== null && (
												<p className="mt-1.5">
													<PredictionNote
														prediction={summary.prediction}
														daysUntil={summary.daysUntil}
														prefix="Nächste Veröffentlichung voraussichtlich am"
													/>
												</p>
											)}
											{jpa.websiteUrl && (
												<a
													href={jpa.websiteUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="mt-2 text-sm font-medium text-seal inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2"
												>
													Website des Prüfungsamts
													<ExternalLink className="w-3.5 h-3.5" />
												</a>
											)}
										</div>

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
									</div>
								</Card>
							);
						})}
					</div>
				)}
			</section>
		</>
	);
}

function Signup({ signedOut }: { signedOut: boolean }) {
	const jpasQuery = trpc.jpa.getAll.useQuery();
	const [jpaId, setJpaId] = useState("");

	useEffect(() => {
		if (!jpaId && jpasQuery.data?.[0]) setJpaId(jpasQuery.data[0].id);
	}, [jpasQuery.data, jpaId]);

	return (
		<div className="max-w-xl">
			<SignupForm
				jpas={jpasQuery.data}
				loading={jpasQuery.isLoading}
				error={jpasQuery.isError}
				jpaId={jpaId}
				onJpaChange={setJpaId}
				source="subscriptions"
			/>
			{signedOut && <ResendManageLink />}
		</div>
	);
}

function ResendManageLink() {
	const [email, setEmail] = useState("");
	const resend = trpc.email.resendManageLink.useMutation();

	const canSubmit = email.includes("@") && !resend.isPending;

	return (
		<section className="mt-12 pt-8 border-t border-ink/10">
			<h2 className="font-semibold">Schon angemeldet?</h2>
			{resend.isSuccess ? (
				<p className="text-[15px] text-ink/65 mt-1" role="status">
					Falls diese Adresse bei uns angemeldet ist, findest du den Link zu
					deinen Einstellungen gleich in deinem Postfach.
				</p>
			) : (
				<>
					<p className="text-[15px] text-ink/65 mt-1 mb-4">
						Wir schicken dir den Link zu deinen Einstellungen noch einmal zu.
					</p>
					<form
						className="flex flex-col sm:flex-row gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							if (canSubmit) resend.mutate({ email });
						}}
					>
						<Input
							type="email"
							autoComplete="email"
							aria-label="E-Mail-Adresse"
							placeholder="name@beispiel.de"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="h-10 text-[15px]"
						/>
						<Button
							type="submit"
							variant="secondary"
							size="sm"
							disabled={!canSubmit}
							className="shrink-0 h-10"
						>
							{resend.isPending ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								"Link zuschicken"
							)}
						</Button>
					</form>
				</>
			)}
		</section>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Check, Copy, ExternalLink, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { OnboardingReminder } from "@/components/onboarding/OnboardingReminder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [onboardingData, setOnboardingData] = useState<{
		ntfyTopic: string;
		subscriptionId: string;
		isFirstSubscription: boolean;
		jpaName: string;
	} | null>(null);

	// tRPC queries
	const jpasQuery = trpc.jpa.getAll.useQuery();
	const subscriptionsQuery = trpc.subscription.getAll.useQuery(undefined, {
		enabled: !!session?.user,
	});

	// tRPC mutations
	const createSubscription = trpc.subscription.create.useMutation({
		onSuccess: (data, variables) => {
			subscriptionsQuery.refetch();
			// Find the JPA name for the subscription
			const jpa = jpasQuery.data?.find((j) => j.id === variables.jpaId);
			// Show onboarding/test modal after every subscription
			setOnboardingData({
				ntfyTopic: data.ntfyTopic,
				subscriptionId: data.id,
				isFirstSubscription: data.isFirstSubscription,
				jpaName: jpa?.name || "JPA",
			});
			setShowOnboarding(true);
		},
	});

	const deleteSubscription = trpc.subscription.delete.useMutation({
		onSuccess: () => {
			subscriptionsQuery.refetch();
		},
	});

	useEffect(() => {
		if (!isPending && !session?.user) {
			navigate({ to: "/auth/login" });
		}
	}, [session, isPending, navigate]);

	const handleSubscribe = async (jpaId: string) => {
		try {
			await createSubscription.mutateAsync({ jpaId });
		} catch (error) {
			console.error("Failed to subscribe:", error);
		}
	};

	const handleUnsubscribe = async (subscriptionId: string) => {
		try {
			await deleteSubscription.mutateAsync({ id: subscriptionId });
		} catch (error) {
			console.error("Failed to unsubscribe:", error);
		}
	};

	const copyToClipboard = async (topic: string) => {
		await navigator.clipboard.writeText(topic);
		setCopiedTopic(topic);
		setTimeout(() => setCopiedTopic(null), 2000);
	};

	const loading =
		isPending || jpasQuery.isLoading || subscriptionsQuery.isLoading;

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	if (!session?.user) {
		return null;
	}

	const jpas = jpasQuery.data ?? [];
	const subscriptions = subscriptionsQuery.data ?? [];

	const userSubscriptions = new Map(
		subscriptions.map((sub) => [sub.jpaId, sub]),
	);

	// Show reminder if user has subscriptions without completed setup
	const showReminder =
		subscriptions.length > 0 &&
		subscriptions.some((s) => !s.setupCompletedAt) &&
		!showOnboarding;

	return (
		<div className="min-h-screen py-8 px-4 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-4xl font-black uppercase mb-2">Dashboard</h1>
					<p className="font-medium">
						Verwalte deine Benachrichtigungen für Examensergebnisse.
					</p>
				</div>

				{/* Onboarding Reminder Banner */}
				{showReminder && (
					<OnboardingReminder
						onSetupClick={() => {
							// Find first incomplete subscription
							const incompleteSub = subscriptions.find(
								(s) => !s.setupCompletedAt,
							);
							if (incompleteSub) {
								const jpa = jpasQuery.data?.find(
									(j) => j.id === incompleteSub.jpaId,
								);
								setOnboardingData({
									ntfyTopic: incompleteSub.ntfyTopic,
									subscriptionId: incompleteSub.id,
									isFirstSubscription: true,
									jpaName: jpa?.name || "JPA",
								});
								setShowOnboarding(true);
							}
						}}
					/>
				)}

				{/* ntfy Setup Instructions - only show when at least one subscription has completed setup */}
				{subscriptions.length > 0 &&
					subscriptions.some((s) => s.setupCompletedAt) && (
						<Card variant="accent" className="mb-8 p-6">
							<div className="flex items-start gap-4">
								<div className="bg-nb-white p-3 border-4 border-nb-black shadow-[var(--nb-shadow-sm)]">
									<Smartphone className="w-8 h-8" />
								</div>
								<div>
									<h2 className="text-xl font-black uppercase mb-2">
										ntfy App einrichten
									</h2>
									<p className="font-medium mb-4">
										Um Push-Benachrichtigungen zu erhalten, installiere die ntfy
										App und abonniere deinen persönlichen Kanal:
									</p>
									<div className="flex flex-wrap gap-3">
										<a
											href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
										>
											<ExternalLink className="w-4 h-4" />
											Android
										</a>
										<a
											href="https://apps.apple.com/app/ntfy/id1625396347"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
										>
											<ExternalLink className="w-4 h-4" />
											iOS
										</a>
										<a
											href="https://ntfy.sh"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
										>
											<ExternalLink className="w-4 h-4" />
											Web
										</a>
									</div>
								</div>
							</div>
						</Card>
					)}

				{/* JPA List */}
				<div className="space-y-4">
					<h2 className="text-2xl font-black uppercase">Justizprüfungsämter</h2>

					{jpas.length === 0 ? (
						<Card className="p-8 text-center">
							<div className="w-16 h-16 bg-nb-yellow border-4 border-nb-black flex items-center justify-center mx-auto mb-4">
								<Bell className="w-8 h-8" />
							</div>
							<p className="font-bold">
								Noch keine Justizprüfungsämter verfügbar.
							</p>
						</Card>
					) : (
						<div className="grid gap-4">
							{jpas.map((jpa) => {
								const subscription = userSubscriptions.get(jpa.id);
								const isSubscribed = !!subscription;

								return (
									<Card
										key={jpa.id}
										variant={isSubscribed ? "success" : "default"}
										className="overflow-hidden"
									>
										{/* Header Section */}
										<div className="p-6 pb-4">
											<div className="flex items-start justify-between gap-4 mb-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-3 mb-2 flex-wrap">
														<h3 className="text-xl font-black uppercase">
															{jpa.name}
														</h3>
														{isSubscribed && <Badge>Abonniert</Badge>}
													</div>
													{jpa.websiteUrl && (
														<a
															href={jpa.websiteUrl}
															target="_blank"
															rel="noopener noreferrer"
															className="text-sm font-bold inline-flex items-center gap-1 underline decoration-2 hover:bg-nb-yellow transition-colors cursor-pointer"
														>
															Zur Website
															<ExternalLink className="w-3 h-3" />
														</a>
													)}
												</div>

												<Button
													onClick={() =>
														isSubscribed && subscription
															? handleUnsubscribe(subscription.id)
															: handleSubscribe(jpa.id)
													}
													variant={isSubscribed ? "destructive" : "default"}
													className="shrink-0"
												>
													{isSubscribed ? "Abbestellen" : "Abonnieren"}
												</Button>
											</div>
										</div>

										{/* Subscription Details Section */}
										{subscription && (
											<div className="px-6 pb-6 space-y-3">
												{/* Incomplete Setup Warning */}
												{!subscription.setupCompletedAt && (
													<div className="p-4 bg-nb-yellow border-3 border-nb-black">
														<div className="flex items-center justify-between gap-4 flex-wrap">
															<div className="flex items-start gap-3">
																<div className="bg-nb-white p-1.5 border-2 border-nb-black shrink-0">
																	<Bell className="w-4 h-4" />
																</div>
																<div>
																	<p className="font-black text-sm uppercase mb-0.5">
																		Setup noch nicht abgeschlossen
																	</p>
																	<p className="text-xs font-medium">
																		Schließe die Einrichtung ab, um
																		Benachrichtigungen zu erhalten
																	</p>
																</div>
															</div>
															<Button
																size="sm"
																onClick={() => {
																	const jpaData = jpasQuery.data?.find(
																		(j) => j.id === subscription.jpaId,
																	);
																	setOnboardingData({
																		ntfyTopic: subscription.ntfyTopic,
																		subscriptionId: subscription.id,
																		isFirstSubscription: subscriptions.every(
																			(s) => s.setupCompletedAt === null,
																		),
																		jpaName: jpaData?.name || "JPA",
																	});
																	setShowOnboarding(true);
																}}
																className="shrink-0"
															>
																Setup fortsetzen
															</Button>
														</div>
													</div>
												)}

												{/* Channel Info */}
												<div className="p-4 bg-nb-white border-3 border-nb-black">
													<div className="flex items-start justify-between gap-3 mb-3">
														<p className="text-xs font-bold uppercase text-nb-black/60">
															Dein ntfy Kanal
														</p>
														{subscription.setupCompletedAt && (
															<div className="flex items-center gap-1.5 text-nb-mint">
																<Check className="w-3.5 h-3.5" />
																<span className="text-xs font-bold uppercase">
																	Eingerichtet
																</span>
															</div>
														)}
													</div>
													<div className="flex items-center gap-2">
														<code className="flex-1 text-sm bg-nb-yellow px-3 py-2 border-2 border-nb-black font-bold break-all">
															{subscription.ntfyTopic}
														</code>
														<Button
															variant="icon"
															size="icon"
															onClick={() =>
																copyToClipboard(subscription.ntfyTopic)
															}
															title="Kopieren"
															className="shrink-0"
														>
															{copiedTopic === subscription.ntfyTopic ? (
																<Check className="w-4 h-4" />
															) : (
																<Copy className="w-4 h-4" />
															)}
														</Button>
													</div>
												</div>
											</div>
										)}
									</Card>
								);
							})}
						</div>
					)}
				</div>

				{/* Onboarding Modal */}
				{onboardingData && (
					<OnboardingModal
						open={showOnboarding}
						onClose={() => {
							setShowOnboarding(false);
							subscriptionsQuery.refetch();
						}}
						ntfyTopic={onboardingData.ntfyTopic}
						subscriptionId={onboardingData.subscriptionId}
						isFirstSubscription={onboardingData.isFirstSubscription}
						jpaName={onboardingData.jpaName}
					/>
				)}
			</div>
		</div>
	);
}

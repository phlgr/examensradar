import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Check,
	CheckCircle,
	Copy,
	ExternalLink,
	Loader2,
	Radar,
	Send,
	Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useClipboard } from "@/hooks/use-clipboard";
import { setDeviceId } from "@/lib/device-id";
import { trpc } from "@/lib/trpc";

const searchSchema = z.object({
	restore: z.uuid().optional(),
});

export const Route = createFileRoute("/subscriptions/")({
	validateSearch: searchSchema,
	component: SubscriptionsPage,
});

function SubscriptionsPage() {
	const { copy, isCopied } = useClipboard();
	const { restore } = Route.useSearch();
	const navigate = useNavigate();
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [showRestoredBanner, setShowRestoredBanner] = useState(false);
	const [onboardingData, setOnboardingData] = useState<{
		ntfyTopic: string;
		subscriptionId: string;
		isFirstSubscription: boolean;
		jpaName: string;
	} | null>(null);

	// Handle restore parameter from notification action
	useEffect(() => {
		if (restore) {
			setDeviceId(restore);
			sessionStorage.setItem("examensradar_restored", "true");
			navigate({ to: "/subscriptions", replace: true });
			window.location.reload();
		}
	}, [restore, navigate]);

	// Show restored banner after restoration
	useEffect(() => {
		if (sessionStorage.getItem("examensradar_restored")) {
			setShowRestoredBanner(true);
			sessionStorage.removeItem("examensradar_restored");
		}
	}, []);

	// tRPC queries
	const jpasQuery = trpc.jpa.getAll.useQuery();
	const subscriptionsQuery = trpc.subscription.getAll.useQuery();

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

	const pingNotification = trpc.user.pingNotification.useMutation();

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

	const loading = jpasQuery.isLoading || subscriptionsQuery.isLoading;

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	const jpas = jpasQuery.data ?? [];
	const subscriptions = subscriptionsQuery.data ?? [];

	const userSubscriptions = new Map(
		subscriptions.map((sub) => [sub.jpaId, sub]),
	);

	return (
		<div className="min-h-screen py-4 sm:py-8 px-4 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6 sm:mb-8">
					<h1 className="text-3xl sm:text-4xl font-black uppercase mb-2">
						Benachrichtigungen
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Verwalte deine Benachrichtigungen für Examensergebnisse.
					</p>
				</div>

				{/* Restored Banner */}
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

				{/* ntfy Setup Instructions - only show when at least one subscription has completed setup */}
				{subscriptions.length > 0 &&
					subscriptions.some((s) => s.setupCompletedAt) && (
						<Card variant="accent" className="mb-6 sm:mb-8 p-4 sm:p-6">
							<div className="flex flex-col sm:flex-row items-start gap-4">
								<div className="bg-nb-white p-3 border-4 border-nb-black shadow-[var(--nb-shadow-sm)] shrink-0">
									<Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />
								</div>
								<div className="flex-1 min-w-0">
									<h2 className="text-lg sm:text-xl font-black uppercase mb-2">
										ntfy App einrichten
									</h2>
									<p className="font-medium text-sm sm:text-base mb-4">
										Um Push-Benachrichtigungen zu erhalten, installiere die ntfy
										App und abonniere deinen persönlichen Kanal:
									</p>
									<div className="flex flex-wrap gap-2 sm:gap-3">
										<a
											href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-xs sm:text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
										>
											<ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
											Android
										</a>
										<a
											href="https://apps.apple.com/app/ntfy/id1625396347"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-xs sm:text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
										>
											<ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
											iOS
										</a>
										<a
											href="https://ntfy.sh"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-xs sm:text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
										>
											<ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
											Web
										</a>
									</div>
								</div>
							</div>
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
								const subscription = userSubscriptions.get(jpa.id);
								const isSubscribed = !!subscription;

								return (
									<Card
										key={jpa.id}
										variant={isSubscribed ? "success" : "default"}
										className="overflow-hidden"
									>
										{/* Header Section */}
										<div className="p-4 sm:p-6 pb-3 sm:pb-4">
											<div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-3">
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

												<Button
													onClick={() =>
														isSubscribed && subscription
															? handleUnsubscribe(subscription.id)
															: handleSubscribe(jpa.id)
													}
													variant={isSubscribed ? "destructive" : "default"}
													className="shrink-0 w-full sm:w-auto"
													size="sm"
												>
													{isSubscribed ? "Abbestellen" : "Abonnieren"}
												</Button>
											</div>
										</div>

										{/* Subscription Details Section */}
										{subscription && (
											<div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3">
												{/* Incomplete Setup Warning */}
												{!subscription.setupCompletedAt && (
													<div className="p-3 sm:p-4 bg-nb-yellow border-3 border-nb-black">
														<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
															<div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
																<div className="bg-nb-white p-1.5 border-2 border-nb-black shrink-0">
																	<Radar className="w-4 h-4" />
																</div>
																<div className="flex-1 min-w-0">
																	<p className="font-black text-xs sm:text-sm uppercase mb-0.5">
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
																className="shrink-0 w-full sm:w-auto"
															>
																Setup fortsetzen
															</Button>
														</div>
													</div>
												)}

												{/* Channel Info */}
												<div className="p-3 sm:p-4 bg-nb-white border-3 border-nb-black">
													<div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
														<p className="text-xs font-bold uppercase text-nb-black/60">
															Dein ntfy Kanal
														</p>
														{subscription.setupCompletedAt && (
															<div className="flex items-center gap-1 sm:gap-1.5 text-nb-mint">
																<Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
																<span className="text-xs font-bold uppercase whitespace-nowrap">
																	Eingerichtet
																</span>
															</div>
														)}
													</div>
													<div className="flex items-center gap-2">
														<code className="flex-1 text-xs sm:text-sm bg-nb-yellow px-2 sm:px-3 py-2 border-2 border-nb-black font-bold break-all">
															{subscription.ntfyTopic}
														</code>
														{subscription.setupCompletedAt && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	pingNotification.mutate({
																		ntfyTopic: subscription.ntfyTopic,
																	})
																}
																disabled={pingNotification.isPending}
																title="Test-Benachrichtigung senden"
																className="shrink-0"
															>
																{pingNotification.isPending ? (
																	<Loader2 className="w-4 h-4 animate-spin" />
																) : (
																	<Send className="w-4 h-4" />
																)}
															</Button>
														)}
														<Button
															variant="icon"
															size="icon"
															onClick={() => copy(subscription.ntfyTopic)}
															title="Kopieren"
															className="shrink-0"
														>
															{isCopied(subscription.ntfyTopic) ? (
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

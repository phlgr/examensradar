import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Check, Copy, ExternalLink, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardPage,
});

interface JPA {
	id: string;
	slug: string;
	name: string;
	websiteUrl: string | null;
}

interface Subscription {
	id: string;
	jpaId: string;
	ntfyTopic: string;
}

function DashboardPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const [jpas, setJpas] = useState<JPA[]>([]);
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [loading, setLoading] = useState(true);
	const [copiedTopic, setCopiedTopic] = useState<string | null>(null);

	useEffect(() => {
		if (!isPending && !session?.user) {
			navigate({ to: "/auth/login" });
		}
	}, [session, isPending, navigate]);

	useEffect(() => {
		if (session?.user) {
			fetchData();
		}
	}, [session]);

	const fetchData = async () => {
		try {
			const [jpasRes, subsRes] = await Promise.all([
				fetch("/api/jpas"),
				fetch("/api/subscriptions"),
			]);
			const jpasData = await jpasRes.json();
			const subsData = await subsRes.json();
			setJpas(jpasData);
			setSubscriptions(subsData);
		} catch (error) {
			console.error("Failed to fetch data:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSubscribe = async (jpaId: string) => {
		try {
			const res = await fetch("/api/subscriptions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jpaId }),
			});
			if (res.ok) {
				fetchData();
			}
		} catch (error) {
			console.error("Failed to subscribe:", error);
		}
	};

	const handleUnsubscribe = async (subscriptionId: string) => {
		try {
			const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
				method: "DELETE",
			});
			if (res.ok) {
				fetchData();
			}
		} catch (error) {
			console.error("Failed to unsubscribe:", error);
		}
	};

	const copyToClipboard = async (topic: string) => {
		await navigator.clipboard.writeText(topic);
		setCopiedTopic(topic);
		setTimeout(() => setCopiedTopic(null), 2000);
	};

	if (isPending || loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	if (!session?.user) {
		return null;
	}

	const userSubscriptions = new Map(
		subscriptions.map((sub) => [sub.jpaId, sub]),
	);

	return (
		<div className="min-h-screen py-8 px-4 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-4xl font-black uppercase mb-2">Dashboard</h1>
					<p className="font-medium">
						Verwalte deine Benachrichtigungen für Examensergebnisse.
					</p>
				</div>

				{/* ntfy Setup Instructions */}
				{subscriptions.length > 0 && (
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
										className="inline-flex items-center gap-2 px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
									>
										<ExternalLink className="w-4 h-4" />
										Android
									</a>
									<a
										href="https://apps.apple.com/app/ntfy/id1625396347"
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
									>
										<ExternalLink className="w-4 h-4" />
										iOS
									</a>
									<a
										href="https://ntfy.sh"
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 px-4 py-2 bg-nb-white border-3 border-nb-black font-bold uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
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
										className="p-6"
									>
										<div className="flex items-start justify-between gap-4">
											<div className="flex-1">
												<div className="flex items-center gap-3 mb-2">
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
														className="text-sm font-bold inline-flex items-center gap-1 underline decoration-2 hover:bg-nb-yellow transition-colors"
													>
														Zur Website
														<ExternalLink className="w-3 h-3" />
													</a>
												)}

												{subscription && (
													<div className="mt-4 p-4 bg-nb-white border-3 border-nb-black">
														<p className="text-xs font-bold uppercase mb-2">
															Dein ntfy Kanal:
														</p>
														<div className="flex items-center gap-2">
															<code className="flex-1 text-sm bg-nb-yellow px-2 py-1 border-2 border-nb-black font-bold">
																{subscription.ntfyTopic}
															</code>
															<Button
																variant="icon"
																size="icon"
																onClick={() =>
																	copyToClipboard(subscription.ntfyTopic)
																}
																title="Kopieren"
															>
																{copiedTopic === subscription.ntfyTopic ? (
																	<Check className="w-4 h-4" />
																) : (
																	<Copy className="w-4 h-4" />
																)}
															</Button>
														</div>
													</div>
												)}
											</div>

											<Button
												onClick={() =>
													isSubscribed
														? handleUnsubscribe(subscription!.id)
														: handleSubscribe(jpa.id)
												}
												variant={isSubscribed ? "destructive" : "default"}
											>
												{isSubscribed ? "Abbestellen" : "Abonnieren"}
											</Button>
										</div>
									</Card>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

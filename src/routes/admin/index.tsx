import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Edit2, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/admin/")({
	component: AdminPage,
});

function AdminPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const [editingJpa, setEditingJpa] = useState<string | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);

	const jpasQuery = trpc.jpa.getAll.useQuery();
	const subscriptionCountsQuery = trpc.jpa.getSubscriptionCounts.useQuery();

	const createJpa = trpc.jpa.create.useMutation({
		onSuccess: () => {
			jpasQuery.refetch();
			setShowCreateForm(false);
		},
	});

	const updateJpa = trpc.jpa.update.useMutation({
		onSuccess: () => {
			jpasQuery.refetch();
			setEditingJpa(null);
		},
	});

	const deleteJpa = trpc.jpa.delete.useMutation({
		onSuccess: () => {
			jpasQuery.refetch();
		},
	});

	useEffect(() => {
		if (!isPending && !session?.user) {
			navigate({ to: "/auth/login" });
		}
		if (!isPending && session?.user && session.user.role !== "admin") {
			navigate({ to: "/subscriptions" });
		}
	}, [session, isPending, navigate]);

	if (isPending || jpasQuery.isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	if (!session?.user || session.user.role !== "admin") {
		return null;
	}

	const jpas = jpasQuery.data ?? [];
	const subscriptionCounts = subscriptionCountsQuery.data ?? {};

	return (
		<div className="min-h-screen py-4 sm:py-8 px-4 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6 sm:mb-8">
					<h1 className="text-3xl sm:text-4xl font-black uppercase mb-2">
						Admin Dashboard
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Verwalte Justizprüfungsämter und Einstellungen.
					</p>
				</div>

				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="text-xl sm:text-2xl font-black uppercase">
							Justizprüfungsämter
						</h2>
						<Button onClick={() => setShowCreateForm(true)} size="sm">
							<Plus className="w-4 h-4" />
							Hinzufügen
						</Button>
					</div>

					{showCreateForm && (
						<JpaForm
							onSubmit={(data) => createJpa.mutate(data)}
							onCancel={() => setShowCreateForm(false)}
							isLoading={createJpa.isPending}
						/>
					)}

					<div className="grid gap-4">
						{jpas.map((jpa) =>
							editingJpa === jpa.id ? (
								<JpaForm
									key={jpa.id}
									initialData={jpa}
									onSubmit={(data) => updateJpa.mutate({ id: jpa.id, ...data })}
									onCancel={() => setEditingJpa(null)}
									isLoading={updateJpa.isPending}
								/>
							) : (
								<Card key={jpa.id} className="p-4 sm:p-6">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-3 mb-1">
												<h3 className="text-lg font-black uppercase">
													{jpa.name}
												</h3>
												<div className="flex items-center gap-1 px-2 py-0.5 bg-nb-yellow border-2 border-nb-black text-xs font-bold">
													<Users className="w-3 h-3" />
													{subscriptionCounts[jpa.id] ?? 0}
												</div>
											</div>
											<p className="text-sm font-medium text-nb-black/60 mb-1">
												Slug: {jpa.slug}
											</p>
											{jpa.websiteUrl && (
												<a
													href={jpa.websiteUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-sm font-bold underline decoration-2 hover:bg-nb-yellow transition-colors"
												>
													{jpa.websiteUrl}
												</a>
											)}
										</div>
										<div className="flex gap-2">
											<Button
												variant="icon"
												size="icon"
												onClick={() => setEditingJpa(jpa.id)}
												title="Bearbeiten"
											>
												<Edit2 className="w-4 h-4" />
											</Button>
											<Button
												variant="icon"
												size="icon"
												onClick={() => {
													if (
														confirm(
															`Möchtest du "${jpa.name}" wirklich löschen?`,
														)
													) {
														deleteJpa.mutate({ id: jpa.id });
													}
												}}
												title="Löschen"
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</div>
									</div>
								</Card>
							),
						)}

						{jpas.length === 0 && !showCreateForm && (
							<Card className="p-8 text-center">
								<p className="font-bold">
									Noch keine Justizprüfungsämter vorhanden.
								</p>
							</Card>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function JpaForm({
	initialData,
	onSubmit,
	onCancel,
	isLoading,
}: {
	initialData?: { name: string; slug: string; websiteUrl: string | null };
	onSubmit: (data: {
		name: string;
		slug: string;
		websiteUrl: string | null;
	}) => void;
	onCancel: () => void;
	isLoading: boolean;
}) {
	const id = useId();
	const [name, setName] = useState(initialData?.name ?? "");
	const [slug, setSlug] = useState(initialData?.slug ?? "");
	const [websiteUrl, setWebsiteUrl] = useState(initialData?.websiteUrl ?? "");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({
			name,
			slug,
			websiteUrl: websiteUrl || null,
		});
	};

	return (
		<Card className="p-4 sm:p-6">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label
						htmlFor={`${id}-name`}
						className="block text-sm font-bold mb-1"
					>
						Name
					</label>
					<input
						id={`${id}-name`}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						className="w-full px-4 py-2 border-2 border-black font-medium focus:outline-none focus:ring-2 focus:ring-nb-coral"
						placeholder="z.B. JPA Bayern"
					/>
				</div>
				<div>
					<label
						htmlFor={`${id}-slug`}
						className="block text-sm font-bold mb-1"
					>
						Slug
					</label>
					<input
						id={`${id}-slug`}
						type="text"
						value={slug}
						onChange={(e) => setSlug(e.target.value)}
						required
						className="w-full px-4 py-2 border-2 border-black font-medium focus:outline-none focus:ring-2 focus:ring-nb-coral"
						placeholder="z.B. bayern"
					/>
				</div>
				<div>
					<label htmlFor={`${id}-url`} className="block text-sm font-bold mb-1">
						Website URL (optional)
					</label>
					<input
						id={`${id}-url`}
						type="url"
						value={websiteUrl}
						onChange={(e) => setWebsiteUrl(e.target.value)}
						className="w-full px-4 py-2 border-2 border-black font-medium focus:outline-none focus:ring-2 focus:ring-nb-coral"
						placeholder="https://..."
					/>
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={isLoading}>
						{isLoading
							? "Wird gespeichert..."
							: initialData
								? "Speichern"
								: "Erstellen"}
					</Button>
					<Button type="button" variant="secondary" onClick={onCancel}>
						Abbrechen
					</Button>
				</div>
			</form>
		</Card>
	);
}

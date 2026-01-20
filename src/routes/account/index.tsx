import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
	Modal,
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@/components/ui/modal";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/account/")({
	component: AccountPage,
});

function AccountPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const deleteAccount = trpc.user.deleteAccount.useMutation({
		onSuccess: async () => {
			await authClient.signOut();
			navigate({ to: "/" });
		},
	});

	useEffect(() => {
		if (!isPending && !session?.user) {
			navigate({ to: "/auth/login" });
		}
	}, [session, isPending, navigate]);

	const handleDeleteAccount = async () => {
		setIsDeleting(true);
		try {
			await deleteAccount.mutateAsync();
		} catch (error) {
			console.error("Failed to delete account:", error);
			setIsDeleting(false);
		}
	};

	if (isPending) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	if (!session?.user) {
		return null;
	}

	return (
		<div className="min-h-screen py-8 px-4 bg-nb-cream">
			<div className="max-w-xl mx-auto">
				<div className="mb-8">
					<h1 className="text-4xl font-black uppercase mb-2">Konto</h1>
					<p className="font-medium">Deine Kontoinformationen.</p>
				</div>

				<Card className="p-6 mb-6">
					<div className="space-y-4">
						<div className="flex items-center gap-3">
							<div className="bg-nb-yellow p-2 border-3 border-nb-black">
								<User className="w-5 h-5" />
							</div>
							<div>
								<p className="text-xs font-bold uppercase text-nb-black/50">
									Name
								</p>
								<p className="font-bold">{session.user.name}</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<div className="bg-nb-teal p-2 border-3 border-nb-black">
								<Mail className="w-5 h-5" />
							</div>
							<div>
								<p className="text-xs font-bold uppercase text-nb-black/50">
									E-Mail
								</p>
								<p className="font-bold">{session.user.email}</p>
							</div>
						</div>
					</div>
				</Card>

				<div className="border-t border-nb-black/10 pt-6">
					<Button
						variant="danger"
						size="sm"
						onClick={() => setShowDeleteConfirm(true)}
					>
						<Trash2 className="w-4 h-4" />
						Konto löschen
					</Button>
				</div>
			</div>

			<Modal
				open={showDeleteConfirm}
				onClose={() => !isDeleting && setShowDeleteConfirm(false)}
				size="sm"
			>
				<ModalHeader>
					<ModalTitle>Konto löschen?</ModalTitle>
				</ModalHeader>
				<ModalBody>
					<p className="font-medium">
						Bist du sicher, dass du dein Konto löschen möchtest? Alle deine
						Abonnements werden ebenfalls gelöscht. Diese Aktion kann nicht
						rückgängig gemacht werden.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button
						variant="secondary"
						onClick={() => setShowDeleteConfirm(false)}
						disabled={isDeleting}
					>
						Abbrechen
					</Button>
					<Button
						variant="destructive"
						onClick={handleDeleteAccount}
						disabled={isDeleting}
					>
						{isDeleting ? "Wird gelöscht..." : "Ja, Konto löschen"}
					</Button>
				</ModalFooter>
			</Modal>
		</div>
	);
}

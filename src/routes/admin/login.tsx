import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/login")({
	component: AdminLoginPage,
});

function AdminLoginPage() {
	const navigate = useNavigate();
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const response = await fetch("/api/admin/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ password }),
			});

			if (response.ok) {
				navigate({ to: "/admin" });
			} else {
				setError("Falsches Passwort");
			}
		} catch {
			setError("Ein Fehler ist aufgetreten");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-nb-cream px-4">
			<Card className="w-full max-w-md p-6 sm:p-8">
				<div className="text-center mb-6">
					<div className="w-16 h-16 bg-nb-yellow border-4 border-nb-black flex items-center justify-center mx-auto mb-4 shadow-[var(--nb-shadow-sm)]">
						<Shield className="w-8 h-8" />
					</div>
					<h1 className="text-2xl font-black uppercase">Admin Login</h1>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="password" className="block text-sm font-bold mb-1">
							Passwort
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full px-4 py-2 border-3 border-nb-black font-medium focus:outline-none focus:ring-2 focus:ring-nb-coral"
							placeholder="Admin-Passwort eingeben"
						/>
					</div>

					{error && (
						<div className="p-3 bg-nb-coral border-3 border-nb-black text-sm font-bold">
							{error}
						</div>
					)}

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Wird überprüft..." : "Anmelden"}
					</Button>
				</form>
			</Card>
		</div>
	);
}

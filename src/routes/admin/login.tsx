import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass, labelClass } from "@/components/ui/input";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/admin/login")({
	head: () => ({ meta: [{ title: "Admin Login | Examensradar" }, noindex] }),
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
		<div className="flex-1 flex items-center justify-center bg-paper px-4">
			<Card className="w-full max-w-md p-6 sm:p-8">
				<div className="text-center mb-6">
					<div className="w-14 h-14 rounded-full bg-seal-soft text-seal grid place-items-center mx-auto mb-4">
						<Shield className="w-6 h-6" />
					</div>
					<h1 className="headline text-3xl">Admin Login</h1>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="password" className={labelClass}>
							Passwort
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className={fieldClass}
							placeholder="Admin-Passwort eingeben"
						/>
					</div>

					{error && (
						<div
							role="alert"
							className="p-3 rounded-md bg-seal-soft ring-1 ring-seal/20 text-sm font-medium text-seal"
						>
							{error}
						</div>
					)}

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Wird überprüft …" : "Anmelden"}
					</Button>
				</form>
			</Card>
		</div>
	);
}

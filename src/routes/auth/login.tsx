import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button, Card } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		if (session?.user) {
			navigate({ to: "/dashboard" });
		}
	}, [session, navigate]);

	const handleGoogleLogin = async () => {
		await authClient.signIn.social({
			provider: "google",
			callbackURL: "/dashboard",
		});
	};

	return (
		<div className="min-h-screen flex items-center justify-center px-4 bg-nb-teal">
			<Card className="max-w-md w-full p-8">
				<div className="text-center mb-8">
					<h1 className="text-4xl font-black uppercase mb-2">Willkommen</h1>
					<p className="font-medium">
						Melde dich an, um Benachrichtigungen zu erhalten.
					</p>
				</div>

				<Button
					type="button"
					onClick={handleGoogleLogin}
					disabled={isPending}
					className="w-full"
				>
					<svg
						className="w-6 h-6"
						viewBox="0 0 24 24"
						role="img"
						aria-label="Google logo"
					>
						<path
							fill="#4285F4"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="#34A853"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="#FBBC05"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					Mit Google anmelden
				</Button>

				<p className="mt-6 text-center text-sm font-medium">
					Mit der Anmeldung akzeptierst du unsere{" "}
					<a
						href="/datenschutz"
						className="underline decoration-2 decoration-nb-coral hover:bg-nb-coral transition-colors"
					>
						Datenschutzerklärung
					</a>
					.
				</p>
			</Card>
		</div>
	);
}

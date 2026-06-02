import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { TRPCProvider } from "@/lib/trpc-provider";
import Header from "../components/Header";

import appCss from "../styles.css?url";

function PlausibleTracker() {
	// The tracker reads `location` at module load and relies on browser APIs, so
	// it must be imported dynamically on the client — a top-level import would
	// crash server-side rendering. autoCapturePageviews (default) hooks the
	// History API, covering SPA navigations without manual router subscriptions.
	useEffect(() => {
		import("@plausible-analytics/tracker").then(({ init }) => {
			init({
				domain: "examensradar.de",
				endpoint: "https://apps.gartz.dev/api/event",
			});
		});
	}, []);
	return null;
}

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Examensradar - Examensergebnisse sofort erfahren",
			},
			{
				name: "description",
				content:
					"Erhalte Push-Benachrichtigungen, wenn das Justizprüfungsamt neue Examensergebnisse veröffentlicht.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="de">
			<head>
				<HeadContent />
			</head>
			<body>
				<TRPCProvider>
					<PlausibleTracker />
					<Header />
					{children}
				</TRPCProvider>
				<Scripts />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
			</body>
		</html>
	);
}

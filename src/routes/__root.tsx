import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { jsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import { TRPCProvider } from "@/lib/trpc-provider";
import Header from "../components/Header";

import appCss from "../styles.css?url";

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
				title: "Examensradar – Examensergebnisse per E-Mail",
			},
			{
				name: "description",
				content:
					"Examensradar schickt dir eine E-Mail, sobald dein Justizprüfungsamt neue Ergebnisse im ersten Staatsexamen veröffentlicht. Kostenlos, ohne Konto.",
			},
			{ name: "theme-color", content: "#f4efe4" },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: SITE_NAME },
			{ property: "og:locale", content: "de_DE" },
			// Pages that must stay out of the index override this with `noindex`.
			{
				name: "robots",
				content: "index, follow, max-image-preview:large, max-snippet:-1",
			},
			{ property: "og:image", content: `${SITE_URL}/og.png` },
			{ property: "og:image:type", content: "image/png" },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{
				property: "og:image:alt",
				content: "Examensradar – Examensergebnisse per E-Mail",
			},
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:image", content: `${SITE_URL}/og.png` },
		],
		links: [
			{ rel: "manifest", href: "/manifest.json" },
			{ rel: "apple-touch-icon", href: "/logo192.png" },
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
		scripts: [
			jsonLd({
				"@graph": [
					{
						"@type": "WebSite",
						"@id": `${SITE_URL}/#website`,
						url: SITE_URL,
						name: SITE_NAME,
						inLanguage: "de-DE",
						description:
							"Kostenlose E-Mail-Benachrichtigung, sobald ein Justizprüfungsamt neue Ergebnisse im ersten juristischen Staatsexamen veröffentlicht, mit Prognose des nächsten Termins.",
					},
					{
						"@type": "WebApplication",
						"@id": `${SITE_URL}/#app`,
						url: SITE_URL,
						name: SITE_NAME,
						applicationCategory: "UtilitiesApplication",
						operatingSystem: "Web",
						inLanguage: "de-DE",
						isAccessibleForFree: true,
						offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
						audience: {
							"@type": "Audience",
							audienceType:
								"Jurastudierende vor dem ersten Staatsexamen (staatliche Pflichtfachprüfung)",
						},
					},
				],
			}),
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
					<div className="min-h-screen flex flex-col">
						<Header />
						<main className="flex-1 flex flex-col">{children}</main>
					</div>
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

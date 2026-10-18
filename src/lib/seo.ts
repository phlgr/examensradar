export const SITE_URL = "https://examensradar.de";
export const SITE_NAME = "Examensradar";

export function jpaParam(slug: string): string {
	return slug
		.toLowerCase()
		.replace(/ä/g, "ae")
		.replace(/ö/g, "oe")
		.replace(/ü/g, "ue")
		.replace(/ß/g, "ss")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export const jpaPath = (slug: string) => `/ergebnisse/${jpaParam(slug)}`;

export const formatLongDate = (date: Date) =>
	date.toLocaleDateString("de-DE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

interface SeoOptions {
	title: string;
	description: string;
	path: string;
}

export function seo({ title, description, path }: SeoOptions) {
	const url = `${SITE_URL}${path}`;
	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: url },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
		],
		links: [
			{ rel: "canonical", href: url },
			{ rel: "alternate", hrefLang: "de", href: url },
			{ rel: "alternate", hrefLang: "x-default", href: url },
		],
	};
}

export const noindex = { name: "robots", content: "noindex, nofollow" };

export interface Faq {
	question: string;
	answer: string;
	signupCta?: string;
}

/**
 * A JSON-LD block for `head().scripts`. `<` is escaped so no string in the
 * data can close the script tag early.
 */
export function jsonLd(data: Record<string, unknown>) {
	return {
		type: "application/ld+json",
		children: JSON.stringify({
			"@context": "https://schema.org",
			...data,
		}).replace(/</g, "\\u003c"),
	};
}

export function faqJsonLd(faqs: Faq[]) {
	return jsonLd({
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: { "@type": "Answer", text: faq.answer },
		})),
	});
}

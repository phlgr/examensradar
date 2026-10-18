export const SITE_URL = "https://examensradar.de";
export const SITE_NAME = "Examensradar";

/**
 * URL segment of an office's page. Slugs carry umlauts ("köln"), which work in
 * URLs but get percent-encoded everywhere they're shared; the page path spells
 * them out the way people type them ("koeln").
 */
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

/** Date with year, for text that may be quoted out of context. */
export const formatLongDate = (date: Date) =>
	date.toLocaleDateString("de-DE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

interface SeoOptions {
	title: string;
	description: string;
	/** Path of the page, for canonical and og:url. */
	path: string;
}

/** Title, description, canonical and the social-card tags for one page. */
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
		// German only, so de and x-default both point back at the page itself.
		links: [
			{ rel: "canonical", href: url },
			{ rel: "alternate", hrefLang: "de", href: url },
			{ rel: "alternate", hrefLang: "x-default", href: url },
		],
	};
}

/** For pages behind a token or login: nothing there for a search index. */
export const noindex = { name: "robots", content: "noindex, nofollow" };

export interface Faq {
	question: string;
	answer: string;
	/** Label for a link to the page's signup form, shown under the answer. */
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

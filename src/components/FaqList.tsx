import type { Faq } from "@/lib/seo";

/**
 * Questions and answers, always expanded: the answers are what people (and
 * the search engines quoting them) came for, so none of it hides behind a
 * click. Pair with `faqJsonLd` in the route's head.
 */
export function FaqList({ faqs }: { faqs: Faq[] }) {
	return (
		<dl className="divide-y divide-ink/10 border-y border-ink/10">
			{faqs.map((faq) => (
				<div
					key={faq.question}
					className="py-6 grid gap-2 md:grid-cols-[0.8fr_1.2fr] md:gap-10"
				>
					<dt className="text-lg font-semibold leading-snug">{faq.question}</dt>
					<dd className="text-ink/70 leading-relaxed">{faq.answer}</dd>
				</div>
			))}
		</dl>
	);
}

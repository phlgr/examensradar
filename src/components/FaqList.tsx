import { ArrowUp } from "lucide-react";
import type { Faq } from "@/lib/seo";

function jumpToSignup() {
	document
		.getElementById("anmelden")
		?.scrollIntoView({ behavior: "smooth", block: "center" });
	document.getElementById("signup-email")?.focus({ preventScroll: true });
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
	return (
		<dl className="divide-y divide-ink/10 border-y border-ink/10">
			{faqs.map((faq) => (
				<div
					key={faq.question}
					className="py-6 grid gap-2 md:grid-cols-[0.8fr_1.2fr] md:gap-10"
				>
					<dt className="text-lg font-semibold leading-snug">{faq.question}</dt>
					<dd className="text-ink/70 leading-relaxed">
						{faq.answer}
						{faq.signupCta && (
							<button
								type="button"
								onClick={jumpToSignup}
								className="mt-3 flex w-fit items-center gap-1.5 font-semibold text-ink border-b-2 border-ink pb-0.5 transition-colors hover:text-seal hover:border-seal"
							>
								{faq.signupCta}
								<ArrowUp className="w-4 h-4" />
							</button>
						)}
					</dd>
				</div>
			))}
		</dl>
	);
}

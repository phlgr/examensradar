import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
	/** Waiting for the visitor to act. */
	pending: "bg-mark text-ink",
	ok: "bg-ok-soft text-ok",
	bad: "bg-seal-soft text-seal",
} as const;

interface StatusPageProps {
	icon: LucideIcon;
	tone: keyof typeof TONES;
	title: string;
	children: React.ReactNode;
}

/**
 * One centred sheet for the single-purpose pages mail links open: confirm,
 * unsubscribe. Icon, title, a sentence or two, and at most one action.
 */
export function StatusPage({
	icon: Icon,
	tone,
	title,
	children,
}: StatusPageProps) {
	return (
		<div className="flex-1 flex items-center justify-center px-4 py-16">
			<Card className="w-full max-w-lg p-8 sm:p-10 text-center">
				<span
					className={cn(
						"w-14 h-14 rounded-full grid place-items-center mx-auto mb-6",
						TONES[tone],
					)}
				>
					<Icon className="w-6 h-6" />
				</span>
				<h1 className="headline text-3xl sm:text-4xl leading-tight mb-3">
					{title}
				</h1>
				<div className="space-y-5 text-[15px] sm:text-base text-ink/70 leading-relaxed">
					{children}
				</div>
			</Card>
		</div>
	);
}

/** Inline link inside a status page's text. */
export const statusLinkClass =
	"font-semibold text-seal underline decoration-1 underline-offset-4 hover:decoration-2";

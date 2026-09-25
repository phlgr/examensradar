import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ButtonProps } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconBox } from "@/components/ui/icon-box";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

interface TeaserCardProps {
	icon: LucideIcon;
	title: string;
	children: ReactNode;
	to: LinkProps["to"];
	action: string;
	/** Card colour; the button picks a matching contrast automatically. */
	variant?: "flat" | "primary";
	className?: string;
}

/**
 * Cross-link between the two main pages: a sentence on what the other page
 * offers and one button to get there.
 */
export function TeaserCard({
	icon: Icon,
	title,
	children,
	to,
	action,
	variant = "flat",
	className,
}: TeaserCardProps) {
	const button: ButtonProps["variant"] =
		variant === "primary" ? "inverse" : "secondary";
	return (
		<Card
			variant={variant}
			className={cn(
				"p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4",
				className,
			)}
		>
			<IconBox color={variant === "primary" ? "white" : "yellow"}>
				<Icon className="w-5 h-5" />
			</IconBox>
			<div className="flex-1 min-w-0">
				<p className="font-black uppercase">{title}</p>
				<p className="text-sm font-medium mt-0.5">{children}</p>
			</div>
			<LinkButton
				to={to}
				variant={button}
				size="sm"
				className="w-full sm:w-auto shrink-0"
			>
				{action}
			</LinkButton>
		</Card>
	);
}

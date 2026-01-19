import { Link, type LinkProps } from "@tanstack/react-router";
import * as React from "react";
import { cn } from "@/lib/utils";
import { type ButtonProps, buttonVariants } from "./button";

export interface LinkButtonProps
	extends Omit<LinkProps, "className">,
		Pick<ButtonProps, "variant" | "size"> {
	className?: string;
}

const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
	({ className, variant, size, ...props }, ref) => {
		return (
			<Link
				ref={ref}
				className={cn(buttonVariants({ variant, size, className }))}
				{...props}
			/>
		);
	},
);
LinkButton.displayName = "LinkButton";

export { LinkButton };

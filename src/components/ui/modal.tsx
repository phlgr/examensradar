import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const modalContentVariants = cva(
	"relative w-full bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)] max-h-[90vh] overflow-y-auto",
	{
		variants: {
			size: {
				sm: "max-w-sm",
				default: "max-w-lg",
				lg: "max-w-2xl",
				xl: "max-w-4xl",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

export interface ModalProps extends VariantProps<typeof modalContentVariants> {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	showCloseButton?: boolean;
	closeOnOverlayClick?: boolean;
}

export function Modal({
	open,
	onClose,
	children,
	size,
	showCloseButton = true,
	closeOnOverlayClick = true,
}: ModalProps) {
	React.useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		if (open) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}
		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 bg-nb-black/60 flex items-center justify-center p-4"
			onClick={closeOnOverlayClick ? onClose : undefined}
			role="dialog"
			aria-modal="true"
		>
			<div
				className={cn(modalContentVariants({ size }))}
				onClick={(e) => e.stopPropagation()}
			>
				{showCloseButton && (
					<Button
						variant="icon"
						size="icon"
						className="absolute top-4 right-4 z-10"
						onClick={onClose}
						aria-label="Schließen"
					>
						<X className="w-5 h-5" />
					</Button>
				)}
				{children}
			</div>
		</div>
	);
}

export function ModalHeader({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6 pb-0", className)} {...props} />;
}

export function ModalTitle({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h2
			className={cn("text-2xl font-black uppercase", className)}
			{...props}
		/>
	);
}

export function ModalBody({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6", className)} {...props} />;
}

export function ModalFooter({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("p-6 pt-0 flex flex-col sm:flex-row gap-3", className)}
			{...props}
		/>
	);
}

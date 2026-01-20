import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const modalContentVariants = cva(
	"relative w-full bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)] max-h-[90vh] overflow-y-auto mx-2 sm:mx-0",
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

	const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (closeOnOverlayClick && e.target === e.currentTarget) {
			onClose();
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 bg-nb-black/60 flex items-center justify-center p-4"
			onClick={handleOverlayClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					handleOverlayClick(e as unknown as React.MouseEvent<HTMLDivElement>);
				}
			}}
			role="dialog"
			aria-modal="true"
		>
			<div className={cn(modalContentVariants({ size }))}>
				{showCloseButton && (
					<Button
						variant="icon"
						size="icon"
						className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10"
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
	return <div className={cn("p-4 sm:p-6 pb-0", className)} {...props} />;
}

export function ModalTitle({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h2
			className={cn("text-xl sm:text-2xl font-black uppercase", className)}
			{...props}
		/>
	);
}

export function ModalBody({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-4 sm:p-6", className)} {...props} />;
}

export function ModalFooter({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("p-4 sm:p-6 pt-0 flex flex-col sm:flex-row gap-2 sm:gap-3", className)}
			{...props}
		/>
	);
}

import type * as React from "react";
import { cn } from "@/lib/utils";

/** A small green status pill, e.g. "Aktiv" on a subscribed office. */
function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok ring-1 ring-ok/15",
				className,
			)}
			{...props}
		/>
	);
}

export { Badge };

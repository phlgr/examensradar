import { useCallback, useState } from "react";

export function useClipboard(resetDelay = 2000) {
	const [copiedValue, setCopiedValue] = useState<string | null>(null);

	const copy = useCallback(
		async (text: string, id?: string) => {
			await navigator.clipboard.writeText(text);
			setCopiedValue(id ?? text);
			setTimeout(() => setCopiedValue(null), resetDelay);
		},
		[resetDelay],
	);

	const isCopied = useCallback(
		(id: string) => copiedValue === id,
		[copiedValue],
	);

	return { copy, copiedValue, isCopied };
}

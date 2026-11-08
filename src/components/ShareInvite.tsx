import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { SITE_URL } from "@/lib/seo";

const SHARE_URL = `${SITE_URL}/?utm_source=share&utm_medium=invite`;
const SHARE_TEXT =
	"Examensradar schickt dir eine kostenlose E-Mail, sobald das Prüfungsamt die Examensergebnisse online stellt – kein Dauer-Neuladen mehr:";

const COPY_LABEL = {
	idle: "Link kopieren",
	copied: "Link kopiert",
	failed: "Kopieren nicht möglich",
} as const;

const isUserCancel = (error: unknown) =>
	error instanceof DOMException && error.name === "AbortError";

function openWhatsApp() {
	trackEvent("share", { method: "whatsapp" });
	window.open(
		`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`,
		"_blank",
		"noopener",
	);
}

export function ShareInvite() {
	const [copyState, setCopyState] = useState<keyof typeof COPY_LABEL>("idle");

	async function share() {
		if (!navigator.share) return openWhatsApp();
		try {
			await navigator.share({ text: SHARE_TEXT, url: SHARE_URL });
			trackEvent("share", { method: "native" });
		} catch (error) {
			if (!isUserCancel(error)) openWhatsApp();
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(SHARE_URL);
			setCopyState("copied");
			trackEvent("share", { method: "copy" });
		} catch {
			setCopyState("failed");
		}
	}

	return (
		<div className="border-t border-ink/10 pt-5">
			<p className="font-semibold text-ink">Wartet deine Lerngruppe mit?</p>
			<p className="mt-1">
				Schick ihnen Examensradar, dann muss niemand mehr die Seite des
				Prüfungsamts neu laden.
			</p>
			<div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
				<Button variant="secondary" onClick={share}>
					<Share2 className="w-4 h-4" />
					Weiterschicken
				</Button>
				<Button variant="ghost" onClick={copy}>
					{copyState === "copied" ? <Check className="w-4 h-4" /> : null}
					{COPY_LABEL[copyState]}
				</Button>
			</div>
		</div>
	);
}

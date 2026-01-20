import { Bell, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface OnboardingReminderProps {
	onSetupClick: () => void;
}

export function OnboardingReminder({ onSetupClick }: OnboardingReminderProps) {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) return null;

	return (
		<Card variant="primary" className="mb-6 p-4">
			<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
				<div className="flex items-start gap-3 flex-1 min-w-0">
					<div className="bg-nb-white p-2 border-3 border-nb-black shrink-0">
						<Bell className="w-5 h-5" />
					</div>
					<div className="flex-1 min-w-0">
						<p className="font-bold text-sm">
							Push-Benachrichtigungen noch nicht eingerichtet
						</p>
						<p className="text-xs font-medium">
							Richte ntfy ein, um keine Ergebnisse zu verpassen.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button size="sm" onClick={onSetupClick} className="flex-1 sm:flex-none">
						Einrichten
					</Button>
					<Button
						variant="icon"
						size="icon"
						onClick={() => setDismissed(true)}
						title="Ausblenden"
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</Card>
	);
}

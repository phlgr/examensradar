export function PageSpinner() {
	return (
		<div className="flex-1 flex items-center justify-center">
			<div
				className="w-8 h-8 rounded-full border-2 border-ink/15 border-t-seal animate-spin"
				role="status"
				aria-label="Lädt"
			/>
		</div>
	);
}

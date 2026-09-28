/** Full-area loading state for a page whose data hasn't arrived yet. */
export function PageSpinner() {
	return (
		<div className="flex-1 flex items-center justify-center bg-nb-cream">
			<div
				className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin"
				role="status"
				aria-label="Lädt"
			/>
		</div>
	);
}

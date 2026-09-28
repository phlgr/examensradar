import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Above this many offices a list gets a search field. */
const SEARCH_THRESHOLD = 6;

/**
 * Case-insensitive name filter for the office lists on /history and
 * /subscriptions: the same input, the same threshold, the same empty state.
 */
export function useJpaSearch<T extends { name: string }>(items: T[]) {
	const [search, setSearch] = useState("");
	const needle = search.trim().toLowerCase();
	const visible = needle
		? items.filter((item) => item.name.toLowerCase().includes(needle))
		: items;
	return {
		search,
		setSearch,
		visible,
		/** Whether the list is long enough to warrant the field. */
		searchable: items.length > SEARCH_THRESHOLD,
		/** A query is set and nothing matches it. */
		empty: needle !== "" && visible.length === 0,
	};
}

export function JpaSearchInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<Input
			type="search"
			placeholder="Prüfungsamt suchen"
			aria-label="Prüfungsamt suchen"
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className="h-10 text-sm sm:max-w-xs"
		/>
	);
}

export function JpaSearchEmpty({ query }: { query: string }) {
	return (
		<Card variant="flat" className="p-6 text-center">
			<p className="font-bold">Kein Prüfungsamt passt zu „{query.trim()}“.</p>
		</Card>
	);
}

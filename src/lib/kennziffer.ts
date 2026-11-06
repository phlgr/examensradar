export interface OralExamAssignment {
	date: string;
	place: string;
	/** "10:00" */
	start?: string;
}

/** Key is a normalized Kennziffer. */
export type KennzifferIndex = Record<string, OralExamAssignment>;

/**
 * "6334/26", " 6334 / 26 " and "6334-26" all become "6334/26", "0997/24" becomes
 * "997/24". Kept apart from oral-exams.ts so the browser bundle does not pull in
 * the parsers.
 */
export function normalizeKennziffer(input: string): string | null {
	const match = input.trim().match(/^(\d{1,4})\s*[/-]\s*(\d{2})$/);
	if (!match) return null;
	const number = Number(match[1]);
	return number > 0 ? `${number}/${match[2]}` : null;
}

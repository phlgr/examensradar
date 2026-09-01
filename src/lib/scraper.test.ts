import { expect, test } from "bun:test";
import { extractContent, hashContent } from "./scraper.ts";

test("extractContent returns the inner HTML of the first match", () => {
	const html = `<html><body>
		<article id="mainArticle"><p>Ergebnisse Mai 2026</p></article>
		<article id="mainArticle"><p>zweiter Treffer</p></article>
	</body></html>`;

	expect(extractContent(html, "article#mainArticle")).toBe(
		"<p>Ergebnisse Mai 2026</p>",
	);
});

test("extractContent handles the Köln :has/:contains selector", () => {
	// Mirrors the structure the OLG Köln selector was written against.
	const html = `<html><body>
		<section class="article-zwischentext">
			<div class="titlebarTitle">Sonstige Hinweise</div>
			<p>irrelevant</p>
		</section>
		<section class="article-zwischentext">
			<div class="titlebarTitle">Hinweise nach § 20 JAG</div>
			<p>Klausurergebnisse</p>
		</section>
	</body></html>`;

	const content = extractContent(
		html,
		'section.article-zwischentext:has(.titlebarTitle:contains("§ 20"))',
	);

	expect(content).toContain("Klausurergebnisse");
	expect(content).not.toContain("irrelevant");
});

test("extractContent returns null when the selector matches nothing", () => {
	// Null, not the full page: a vanished selector must read as a broken
	// scraper, never as a content change.
	expect(
		extractContent("<html><body><p>relaunch</p></body></html>", "article#gone"),
	).toBeNull();
});

test("hashContent is stable and content-sensitive", () => {
	expect(hashContent("abc")).toBe(hashContent("abc"));
	expect(hashContent("abc")).not.toBe(hashContent("abd"));
	expect(hashContent("abc")).toMatch(/^[0-9a-f]{64}$/);
});

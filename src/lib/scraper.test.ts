import { expect, test } from "bun:test";
import { extractContent, hashContent } from "./scraper.ts";

test("extractContent returns the inner HTML of the first match", () => {
	const html = `<html><body>
		<article id="mainArticle"><p>Ergebnisse Mai 2026</p></article>
		<article id="mainArticle"><p>zweiter Treffer</p></article>
	</body></html>`;

	expect(extractContent(html, "article#mainArticle")).toEqual({
		matched: true,
		content: "<p>Ergebnisse Mai 2026</p>",
	});
});

test("extractContent handles the Köln :has/:contains selector", () => {
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

	const extraction = extractContent(
		html,
		'section.article-zwischentext:has(.titlebarTitle:contains("§ 20"))',
	);

	if (!extraction.matched) throw new Error("selector should match");
	expect(extraction.content).toContain("Klausurergebnisse");
	expect(extraction.content).not.toContain("irrelevant");
});

test("extractContent reports no match when the selector matches nothing", () => {
	expect(
		extractContent("<html><body><p>relaunch</p></body></html>", "article#gone"),
	).toEqual({ matched: false });
});

test("hashContent is stable and content-sensitive", () => {
	expect(hashContent("abc")).toBe(hashContent("abc"));
	expect(hashContent("abc")).not.toBe(hashContent("abd"));
	expect(hashContent("abc")).toMatch(/^[0-9a-f]{64}$/);
});

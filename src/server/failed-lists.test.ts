import { afterAll, expect, mock, test } from "bun:test";
// Shared test DB — see src/test-setup.ts.
import "../test-setup.ts";

const { createJpa, getFailedLists } = await import("../db/index.ts");
const { recordFailedLists } = await import("./failed-lists.ts");

const realFetch = globalThis.fetch;

afterAll(() => {
	globalThis.fetch = realFetch;
});

/** A minimal single-page PDF with one text line per entry. */
function pdfWithLines(lines: string[]): Uint8Array<ArrayBuffer> {
	const stream = [
		"BT /F1 12 Tf 14 TL 72 720 Td",
		...lines.map((line) => `(${line}) Tj T*`),
		"ET",
	].join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
	let body = "%PDF-1.4\n";
	const offsets = objects.map((object, i) => {
		const offset = body.length;
		body += `${i + 1} 0 obj\n${object}\nendobj\n`;
		return offset;
	});
	const xref = body.length;
	body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) {
		body += `${String(offset).padStart(10, "0")} 00000 n \n`;
	}
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return new TextEncoder().encode(body);
}

const serve = (files: Record<string, Uint8Array<ArrayBuffer>>) => {
	const fetchMock = mock(async (url: string | URL) => {
		const file = files[String(url)];
		return file ? new Response(file) : new Response(null, { status: 404 });
	});
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
};

const PAGE = "https://example.org/pruefungsamt/aktuelles/index.php";
const LIST = "https://example.org/pruefungsamt/aktuelles/Liste-Juni-2026.pdf";
const section = `<p>haben die Prüflinge mit den folgenden Kennziffern nicht bestanden:</p>
	<a href="Liste-Juni-2026.pdf">Liste Juni 2026</a>`;

const testJpa = () =>
	createJpa({
		name: "Listen-JPA",
		slug: `failed-lists-test-${crypto.randomUUID()}`,
	});

test("counts a new list once, however often the page is checked", async () => {
	const jpa = await testJpa();
	const fetchMock = serve({
		[LIST]: pdfWithLines(["Kennziffer", "127/24", "174/24", "1044/26"]),
	});

	await recordFailedLists(jpa, PAGE, section);
	await recordFailedLists(jpa, PAGE, section);

	expect(fetchMock).toHaveBeenCalledTimes(1);
	const lists = (await getFailedLists()).filter((l) => l.jpaSlug === jpa.slug);
	expect(lists).toEqual([
		expect.objectContaining({
			examMonth: "2026-06",
			failedCount: 3,
			url: LIST,
		}),
	]);
});

test("a list without Kennziffern is not stored as zero", async () => {
	const jpa = await testJpa();
	const url = "https://example.org/leer/Liste-Mai-2026.pdf";
	serve({ [url]: pdfWithLines(["Keine Liste mehr"]) });

	await recordFailedLists(
		jpa,
		"https://example.org/leer/",
		`<a href="Liste-Mai-2026.pdf">Liste</a>`,
	);

	const lists = (await getFailedLists()).filter((l) => l.jpaSlug === jpa.slug);
	expect(lists).toEqual([]);
});

test("a failed download is swallowed and retried next time", async () => {
	const jpa = await testJpa();
	const url = "https://example.org/retry/Liste-Juli-2026.pdf";
	const html = `<a href="Liste-Juli-2026.pdf">Liste</a>`;

	serve({});
	await recordFailedLists(jpa, "https://example.org/retry/", html);
	serve({ [url]: pdfWithLines(["9/26"]) });
	await recordFailedLists(jpa, "https://example.org/retry/", html);

	const lists = (await getFailedLists()).filter((l) => l.jpaSlug === jpa.slug);
	expect(lists.map((l) => l.failedCount)).toEqual([1]);
});

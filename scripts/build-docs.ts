/**
 * Builds the derived documents so nothing is maintained twice:
 *   1. the decisions table in README.md, from every "[decision]" sentence in docs/GAME.md
 *   2. docs/architecture.png and docs/schema.png, from the Mermaid blocks in README.md
 *   3. docs/submission/Kindscore-Submission.pdf, from README + TESTING + screenshots
 *   4. the character count of docs/SUBMISSION_NOTES.md
 *
 *   pnpm docs:build
 * Playwright's Chromium renders Mermaid (from jsdelivr) and prints the PDF — no other native deps.
 */
import { chromium } from "playwright";
import { marked } from "marked";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const README = path.join(ROOT, "README.md");
const GAME = path.join(ROOT, "docs/GAME.md");
const TESTING = path.join(ROOT, "docs/TESTING.md");
const NOTES = path.join(ROOT, "docs/SUBMISSION_NOTES.md");
const PDF_DIR = path.join(ROOT, "docs/submission");
const NOTES_LIMIT = 2048;

// ── 1. Decisions table ───────────────────────────────────────────────────────

interface Decision {
  section: string;
  text: string;
}

const MARKER = "**[decision]**";
/** A marker followed by ":" or a few words introduces a list; the decisions are the bullets. */
const MIN_DECISION_LENGTH = 24;

/**
 * Every "[decision]" sentence in GAME.md with its section heading. The line is cut at each marker
 * first (the next sentence usually begins with another marker, which no sentence regex sees), then
 * the first sentence of each cut is kept. The legend above the first section is skipped.
 */
async function extractDecisions(): Promise<Decision[]> {
  const md = await readFile(GAME, "utf8");
  const decisions: Decision[] = [];
  let section = "";
  for (const line of md.split("\n")) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) section = heading[1].replace(/\(§.*?\)/g, "").trim();
    if (!section) continue;
    for (const cut of line.split(MARKER).slice(1)) {
      const text = clean(firstSentence(cut));
      if (text.length >= MIN_DECISION_LENGTH) decisions.push({ section, text });
    }
  }
  return decisions;
}

function firstSentence(text: string): string {
  return text.trim().split(/(?<=[.!?])\s+(?=[A-Z"“(])/)[0];
}

function clean(markdown: string): string {
  return markdown
    .replace(/\*\*/g, "")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\|/g, "·")
    .trim();
}

async function writeDecisionsTable(decisions: Decision[]): Promise<void> {
  const rows = decisions.map((d, i) => `| ${i + 1} | ${d.section} | ${d.text} |`).join("\n");
  const table = `| # | Where | Decision |\n| --- | --- | --- |\n${rows}`;
  const readme = await readFile(README, "utf8");
  const next = readme.replace(
    /<!-- decisions:start -->[\s\S]*?<!-- decisions:end -->/,
    `<!-- decisions:start -->\n${table}\n<!-- decisions:end -->`,
  );
  await writeFile(README, next);
  console.log(`decisions table: ${decisions.length} rows`);
}

// ── 2. Mermaid → PNG ─────────────────────────────────────────────────────────

function mermaidBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
}

async function renderMermaid(blocks: string[], names: string[]): Promise<string[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  const files: string[] = [];
  for (const [i, code] of blocks.entries()) {
    const html = `<!doctype html><html><body style="margin:0;background:#F7F3EC;padding:32px;font-family:Inter,system-ui,sans-serif">
      <pre class="mermaid">${code.replace(/</g, "&lt;")}</pre>
      <script type="module">
        import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
        mermaid.initialize({ startOnLoad: false, theme: "neutral", themeVariables: { primaryColor: "#FDFBF7", primaryBorderColor: "#D9791A", lineColor: "#171411", fontFamily: "Inter, system-ui, sans-serif" } });
        try {
          await mermaid.run();
          document.body.dataset.ready = "1";
        } catch (error) {
          document.body.dataset.error = String(error && error.message ? error.message : error);
        }
      </script></body></html>`;
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForSelector("body[data-ready='1'], body[data-error]", { timeout: 60_000 });
    const failure = await page.evaluate(() => document.body.dataset.error);
    if (failure) throw new Error(`mermaid (${names[i]}): ${failure}`);
    const svg = page.locator("svg").first();
    const file = path.join(ROOT, "docs", `${names[i]}.png`);
    await svg.screenshot({ path: file });
    files.push(file);
    console.log(`rendered ${names[i]}.png`);
  }
  await browser.close();
  return files;
}

// ── 3. PDF ───────────────────────────────────────────────────────────────────

const SAFFRON = "#D9791A";
const INK = "#171411";
const INK_2 = "#5E574F";
const LINE = "#DED8CF";
const IVORY = "#F7F3EC";

/** Print stylesheet: ivory, ink and one saffron accent — the site's palette on A4. */
const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: ${INK}; font-size: 11pt; line-height: 1.45; }
  h1, h2, h3 { font-weight: 500; letter-spacing: -0.01em; }
  h1 { font-size: 26pt; margin: 0 0 10pt; padding-bottom: 6pt; border-bottom: 2px solid ${SAFFRON}; }
  h2 { font-size: 16pt; margin: 22pt 0 8pt; padding-left: 8pt; border-left: 3px solid ${SAFFRON}; }
  h3 { font-size: 13pt; }
  p, li { max-width: 170mm; }
  ol > li { margin: 0 0 8pt; padding-left: 4pt; }
  ol > li::marker { color: ${SAFFRON}; font-family: Inter, system-ui, sans-serif; font-weight: 600; }
  li em { display: block; color: ${INK_2}; font-size: 10pt; margin-top: 1pt; }
  .cover { height: 240mm; display: flex; flex-direction: column; justify-content: space-between; }
  .cover .block { width: 28mm; height: 6mm; background: ${SAFFRON}; margin-bottom: 14mm; }
  .cover .wordmark { font-size: 44pt; line-height: 1; } .cover .wordmark span { color: ${SAFFRON}; }
  .cover .tag { font-size: 20pt; color: ${INK_2}; margin-top: 6pt; }
  .cover .pitch { font-size: 16pt; max-width: 125mm; }
  .cover .meta { font-family: Inter, system-ui, sans-serif; font-size: 10pt; color: ${INK_2}; }
  .cover .accounts { margin-top: 10mm; font-family: Inter, system-ui, sans-serif; font-size: 10pt; border-top: 1px solid ${LINE}; padding-top: 6pt; }
  table { border-collapse: collapse; width: 100%; font-family: Inter, system-ui, sans-serif; font-size: 9pt; page-break-inside: auto; margin: 6pt 0 12pt; }
  th, td { border-bottom: 1px solid ${LINE}; padding: 5pt 6pt; vertical-align: top; text-align: left; }
  th { background: ${IVORY}; font-weight: 600; border-bottom: 2px solid ${SAFFRON}; } tr { page-break-inside: avoid; }
  code { font-family: Consolas, monospace; font-size: 9pt; background: ${IVORY}; padding: 0 3pt; border-radius: 2pt; }
  pre { display: none; }
  img { max-width: 100%; border: 1px solid ${LINE}; border-radius: 3pt; page-break-inside: avoid; }
  figure { margin: 0 0 14pt; } figcaption { font-family: Inter, system-ui, sans-serif; font-size: 9pt; color: ${INK_2}; margin-top: 3pt; }
  .page { page-break-before: always; }
  a { color: ${INK}; }
`;

async function screenshotsGallery(): Promise<string> {
  const dir = path.join(ROOT, "docs/screenshots");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();
  const items = await Promise.all(
    files.map(async (f) => {
      const data = await readFile(path.join(dir, f));
      const caption = f
        .replace(/^\d+-/, "")
        .replace(/\.png$/, "")
        .replace(/-/g, " ");
      return `<figure><img src="data:image/png;base64,${data.toString("base64")}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
    }),
  );
  return items.join("\n");
}

/** The code-formatted value of a "| **Label** | `value` |" row in the README, HTML-escaped (placeholders look like tags). */
function readmeCell(readme: string, label: string): string {
  const row = readme.split("\n").find((line) => line.includes(`**${label}**`)) ?? "";
  const value = /`([^`]+)`/.exec(row)?.[1] ?? "";
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function buildPdf(diagrams: string[]): Promise<void> {
  await mkdir(PDF_DIR, { recursive: true });
  const readme = await readFile(README, "utf8");
  const testing = await readFile(TESTING, "utf8");
  const [architecture, schema] = await Promise.all(diagrams.map((f) => readFile(f)));
  const inline = (buf: Buffer, alt: string) =>
    `<figure><img src="data:image/png;base64,${buf.toString("base64")}" alt="${alt}"></figure>`;

  // README without its first heading (the cover replaces it) and with Mermaid blocks swapped for the PNGs.
  let readmeBody = readme.replace(/^# .*\n/, "");
  let n = 0;
  readmeBody = readmeBody.replace(/```mermaid\n[\s\S]*?```/g, () =>
    n++ === 0 ? "%%ARCH%%" : "%%SCHEMA%%",
  );
  const readmeHtml = (await marked.parse(readmeBody))
    .replace("%%ARCH%%", inline(architecture, "Architecture"))
    .replace("%%SCHEMA%%", inline(schema, "Data model"));
  const testingHtml = await marked.parse(testing.replace(/^# .*\n/, ""));
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>
    <section class="cover">
      <div><div class="block"></div><div class="wordmark">Kindscore<span>.</span></div><div class="tag">Give every month. Win some months.</div></div>
      <div><p class="pitch">A charity lottery for golfers: your last five Stableford scores are your lottery numbers, and at least 10% of every fee goes to a charity you choose.</p>
      <p class="meta">Digital Heroes · Level 1 PRD · submission · ${today}<br>${readmeCell(readme, "Live site")} · ${readmeCell(readme, "Repository")}</p>
      <p class="accounts"><strong>Demo accounts</strong> (password <code>Kindscore!2026</code>): <code>admin@kindscore.app</code> · <code>priya@kindscore.app</code> · <code>raj@kindscore.app</code> · <code>anita@kindscore.app</code> — see page 2.</p></div>
    </section>
    <section class="page"><h1>Testing script</h1>${testingHtml}</section>
    <section class="page"><h1>Kindscore</h1>${readmeHtml}</section>
    <section class="page"><h1>Screens</h1>${await screenshotsGallery()}</section>
  </body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const file = path.join(PDF_DIR, "Kindscore-Submission.pdf");
  await page.pdf({ path: file, format: "A4", printBackground: true });
  await browser.close();
  console.log(`pdf: ${path.relative(ROOT, file)}`);
}

// ── 4. Notes length ──────────────────────────────────────────────────────────

async function checkNotes(): Promise<void> {
  const md = await readFile(NOTES, "utf8");
  const blurb = md.split("\n---\n")[1]?.trim() ?? "";
  const status = blurb.length <= NOTES_LIMIT ? "ok" : "TOO LONG";
  console.log(`notes: ${blurb.length}/${NOTES_LIMIT} characters — ${status}`);
}

async function main() {
  await writeDecisionsTable(await extractDecisions());
  const readme = await readFile(README, "utf8");
  const diagrams = await renderMermaid(mermaidBlocks(readme), ["architecture", "schema"]);
  await buildPdf(diagrams);
  await checkNotes();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

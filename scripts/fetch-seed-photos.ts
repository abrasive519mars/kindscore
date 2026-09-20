/**
 * Downloads the seed charity photos listed in public/seed/manifest.json, converts them to
 * WebP at web-appropriate sizes, and writes docs/CREDITS.md.
 *
 * Idempotent: existing outputs are skipped unless --force is passed.
 *   pnpm tsx scripts/fetch-seed-photos.ts [--force]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Role = "cover" | "gallery-1" | "gallery-2";

interface ManifestImage {
  charity: string;
  role: Role;
  source: "unsplash" | "pexels";
  page_url: string;
  download_url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "public", "seed", "manifest.json");
const OUTPUT_DIR = path.join(ROOT, "public", "seed");
const CREDITS_PATH = path.join(ROOT, "docs", "CREDITS.md");

/** Covers lead a page; gallery images sit in a grid. Widths chosen for a 2× 800px column. */
const TARGET_WIDTH: Record<Role, number> = { cover: 1600, "gallery-1": 1200, "gallery-2": 1200 };
const WEBP_QUALITY = 78;

const LICENCE_URL = {
  unsplash: "https://unsplash.com/license",
  pexels: "https://www.pexels.com/license/",
} as const;

async function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

async function readManifest(): Promise<ManifestImage[]> {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return (JSON.parse(raw) as { images: ManifestImage[] }).images;
}

function outputPathFor(image: ManifestImage): string {
  return path.join(OUTPUT_DIR, image.charity, `${image.role}.webp`);
}

async function downloadBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { "user-agent": "kindscore-seed/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function convertToWebp(bytes: Buffer, width: number): Promise<Buffer> {
  return sharp(bytes)
    .rotate() // honour EXIF orientation before resizing
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function processImage(image: ManifestImage, force: boolean): Promise<"written" | "skipped"> {
  const target = outputPathFor(image);
  if (!force && (await fileExists(target))) return "skipped";

  const bytes = await downloadBytes(image.download_url);
  const webp = await convertToWebp(bytes, TARGET_WIDTH[image.role]);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, webp);
  return "written";
}

function creditLine(image: ManifestImage): string {
  const file = `public/seed/${image.charity}/${image.role}.webp`;
  return `| \`${file}\` | [${image.photographer}](${image.photographer_url}) | [${image.source}](${image.page_url}) | ${image.alt} |`;
}

function renderCredits(images: ManifestImage[]): string {
  const header = [
    "# Photo credits",
    "",
    "Seed photography for the demo charities. Every image is used under the",
    `[Unsplash License](${LICENCE_URL.unsplash}) or the [Pexels License](${LICENCE_URL.pexels}) — free for commercial use,`,
    "no attribution required; credited here anyway. The charities are fictional; the people and places are real.",
    "",
    "Regenerate with `pnpm tsx scripts/fetch-seed-photos.ts`. Source of truth: `public/seed/manifest.json`.",
    "",
    "| File | Photographer | Source | Description |",
    "|---|---|---|---|",
  ];
  return [...header, ...images.map(creditLine), ""].join("\n");
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const images = await readManifest();

  for (const image of images) {
    const result = await processImage(image, force);
    console.log(`${result.padEnd(8)} ${image.charity}/${image.role}`);
  }

  await writeFile(CREDITS_PATH, renderCredits(images), "utf8");
  console.log(`credits  docs/CREDITS.md (${images.length} images)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

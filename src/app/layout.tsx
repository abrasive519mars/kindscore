import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { BRAND } from "@/config/constants";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  // The optical-size axis doubled each file to ~140 KB; the fixed default reads identically at our sizes.
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      "A charity lottery for golfers. Your last five Stableford scores are your numbers; at least ₹50 of every month goes to a charity you choose.",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "A charity lottery for golfers. Your last five Stableford scores are your numbers; at least ₹50 of every month goes to a charity you choose.",
};

/**
 * Runs before paint so a saved theme choice never flashes the wrong colours.
 * Reads localStorage defensively: private windows and blocked storage must not break the page.
 */
const themeInitScript = `
try {
  var t = localStorage.getItem("kindscore-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${inter.variable} ${newsreader.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

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
  axes: ["opsz"],
});

export const metadata: Metadata = {
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

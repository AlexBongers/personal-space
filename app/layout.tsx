import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./personal-space/i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://personal-space.a-a-t-bongers.chatgpt.site"),
  title: "Personal Space — Your quiet knowledge manager",
  description: "A private, local-first workspace for pages, projects, notes and ideas.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Personal Space",
    description: "A calm place for busy minds.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Personal Space — A calm place for busy minds" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personal Space",
    description: "A calm place for busy minds.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}

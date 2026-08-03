import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Space — Your quiet knowledge manager",
  description: "A private, local-first workspace for pages, projects, notes and ideas.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caddo State — Team Tools",
  description: "Manage seasons, rosters, schedule, and stats for Caddo State.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* ESPN-style team-color accent strip */}
        <div className="h-1 bg-primary" />
        <header className="border-b bg-card">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/caddo-cs-mark.png"
                alt="Caddo State"
                className="h-10 w-auto"
              />
              <span className="leading-none">
                <span className="block font-heading text-lg font-extrabold uppercase tracking-tight text-primary">
                  Caddo State
                </span>
                <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Team Tools
                </span>
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-sm">
              <Link
                href="/seasons/current"
                className="border-b-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-[var(--brand-gold)] hover:text-foreground"
              >
                Season
              </Link>
              <Link
                href="/seasons"
                className="border-b-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-[var(--brand-gold)] hover:text-foreground"
              >
                History
              </Link>
              <Link
                href="/players"
                className="border-b-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-[var(--brand-gold)] hover:text-foreground"
              >
                Players
              </Link>
              <Link
                href="/media"
                className="border-b-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-[var(--brand-gold)] hover:text-foreground"
              >
                Media
              </Link>
              <Link
                href="/settings/media"
                className="border-b-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-[var(--brand-gold)] hover:text-foreground"
              >
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}

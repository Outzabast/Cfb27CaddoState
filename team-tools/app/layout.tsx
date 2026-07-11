import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { MainNav } from "@/components/main-nav";

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
        <header className="relative border-b bg-card">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/caddo-cs-mark.png"
                alt="Caddo State"
                className="h-10 w-auto"
              />
              <span className="leading-none">
                <span className="block font-heading text-base font-extrabold uppercase tracking-tight text-primary sm:text-lg">
                  Caddo State
                </span>
                <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Team Tools
                </span>
              </span>
            </Link>
            <MainNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}

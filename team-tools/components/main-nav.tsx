"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";

const LINKS = [
  { href: "/seasons/current", label: "Season" },
  { href: "/seasons", label: "History" },
  { href: "/players", label: "Players" },
  { href: "/staff", label: "Staff" },
  { href: "/recruits", label: "Recruits" },
  { href: "/media", label: "Media" },
  { href: "/settings/media", label: "Settings" },
];

const linkClass =
  "border-b-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-[var(--brand-gold)] hover:text-foreground";

/** App nav: a horizontal row on ≥sm screens, a hamburger-toggled panel below the
 *  header on phones. Closes on navigation and on route change. */
export function MainNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Desktop */}
      <nav className="ml-auto hidden items-center gap-1 text-sm sm:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass}>
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Mobile toggle — 44px tap target, iOS-friendly touch handling */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="-mr-2 ml-auto inline-flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground sm:hidden"
      >
        {open ? <XIcon className="size-6" /> : <MenuIcon className="size-6" />}
      </button>

      {/* Mobile panel */}
      {open && (
        <div className="absolute inset-x-0 top-full z-50 border-b bg-card shadow-md sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-1">
            {LINKS.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={
                    "border-b border-border/50 px-1 py-3 text-sm font-bold uppercase tracking-wide last:border-0 hover:text-foreground " +
                    (active ? "text-foreground" : "text-muted-foreground")
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}

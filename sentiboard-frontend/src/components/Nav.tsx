"use client";

/* Top navigation. Ported from the prototype's Nav.tsx (react-router → next/link + usePathname). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { ROUTES } from "@/lib/routes";

type NavItem = { to: string; label: string };
type NavGroup = { label: string; children: NavItem[] };

const LINKS: (NavItem | NavGroup)[] = [
  {
    label: "Acquisitions",
    children: [
      { to: ROUTES.acquisitionsGlobe.path, label: ROUTES.acquisitionsGlobe.title },
      { to: ROUTES.acquisitionsEarth.path, label: ROUTES.acquisitionsEarth.title },
    ],
  },
  { to: ROUTES.events.path, label: ROUTES.events.title },
  { to: ROUTES.availability.path, label: ROUTES.availability.title },
  { to: ROUTES.processors.path, label: ROUTES.processors.title },
];

const isGroup = (l: NavItem | NavGroup): l is NavGroup => "children" in l;

/** NavLink's `end={false}`: the link is active on its path and anything below it. */
const isActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

/** The partner logos are a server component, passed in from the layout. */
export default function Nav({ partners }: { partners: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Below 760px the links become a sheet that overlays the page, so it has to be dismissed
  // as well as opened. Each link already closes it on click, but a route reached any other
  // way (browser back, a link inside the page) would otherwise leave the sheet covering the
  // destination.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
    setSubOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!subOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!groupRef.current?.contains(e.target as Node)) setSubOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [subOpen]);

  return (
    <header className={"nav" + (open ? " open" : "")}>
      <div className="nav-inner">
        <Link
          href={ROUTES.home.path}
          className="brand"
          onClick={() => setOpen(false)}
          aria-label="SentiBoard — home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-logo"
            src="/assets/img/sentiboard.png"
            alt="SentiBoard"
          />
        </Link>
        <nav className="nav-links" id="nav-links">
          {LINKS.map((l) => {
            if (!isGroup(l)) {
              return (
                <Link
                  key={l.to}
                  href={l.to}
                  onClick={() => setOpen(false)}
                  className={isActive(pathname, l.to) ? "active" : ""}
                  aria-current={isActive(pathname, l.to) ? "page" : undefined}
                >
                  {l.label}
                </Link>
              );
            }
            const groupActive = l.children.some((c) => pathname === c.to);
            return (
              <div className="nav-group" key={l.label} ref={groupRef}>
                <button
                  type="button"
                  className={"nav-group-toggle" + (groupActive ? " active" : "")}
                  aria-expanded={subOpen}
                  aria-controls="nav-sub-acquisitions"
                  onClick={() => setSubOpen((o) => !o)}
                >
                  {l.label}
                  <ChevronDown size={12} aria-hidden />
                </button>
                <div
                  id="nav-sub-acquisitions"
                  className={"nav-sub" + (subOpen ? " open" : "")}
                >
                  {l.children.map((c) => (
                    <Link
                      key={c.to}
                      href={c.to}
                      onClick={() => {
                        setOpen(false);
                        setSubOpen(false);
                      }}
                      className={isActive(pathname, c.to) ? "active" : ""}
                      aria-current={isActive(pathname, c.to) ? "page" : undefined}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="nav-right">
          <div className="nav-partners">{partners}</div>
          <ThemeToggle />
          <button
            className="nav-burger"
            aria-label={open ? "Close menu" : "Menu"}
            aria-expanded={open}
            aria-controls="nav-links"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <X size={22} aria-hidden />
            ) : (
              <Menu size={22} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

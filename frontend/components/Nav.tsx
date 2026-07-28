"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LiveClock from "./LiveClock";

const LINKS = [
  { href: "/v1", label: "Index" },
  { href: "/v1/about", label: "About" },
  { href: "/v1/events", label: "Events" },
  { href: "/v1/availability", label: "Data Availability" },
  { href: "/v1/processors", label: "Processors" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link className="brand" href="/v1">
          <img src="/assets/img/sentiboard.png" alt="SentiBoard" className="brand-logo" />
        </Link>
        <nav className="links">
          {LINKS.map((l) => {
            const active = l.href === "/v1" ? path === "/v1" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={active ? "active" : ""}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="nav-agencies">
          <a href="https://www.copernicus.eu/" target="_blank" rel="noopener" title="Copernicus">
            <img src="/assets/img/copernicus_logo.png" alt="Copernicus" />
          </a>
        </div>
      </div>
    </header>
  );
}

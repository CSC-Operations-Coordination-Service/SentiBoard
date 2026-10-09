import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Partners from "./Partners";

type NavItem = { to: string; label: string; end?: boolean };
type NavGroup = { label: string; children: NavItem[] };

const LINKS: (NavItem | NavGroup)[] = [
  //{ to: "/examples/index1", label: "Index", end: true },
  {
    label: "Acquisitions",
    children: [
      { to: "/acquisitions-globe", label: "Acquisitions - Globe" },
      { to: "/acquisitions-globe-earth", label: "Acquisitions - Earth" },
    ],
  },
  { to: "/events", label: "Events", end: false },
  { to: "/availability", label: "Data Availability", end: false },
  { to: "/processors", label: "Processors", end: false },
];

const isGroup = (l: NavItem | NavGroup): l is NavGroup => "children" in l;

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Below 760px the links become a sheet that overlays the page, so it has to be dismissed
  // as well as opened. Each link already closes it on click, but a route reached any other
  // way (browser back, a link inside the page) would otherwise leave the sheet covering the
  // destination.
  useEffect(() => {
    setOpen(false);
    setSubOpen(false);
  }, [pathname]);

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
          to="/index"
          className="brand"
          onClick={() => setOpen(false)}
          aria-label="SentiBoard — home"
        >
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
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {l.label}
                </NavLink>
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
                    <NavLink
                      key={c.to}
                      to={c.to}
                      onClick={() => {
                        setOpen(false);
                        setSubOpen(false);
                      }}
                      className={({ isActive }) => (isActive ? "active" : "")}
                    >
                      {c.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="nav-right">
          <div className="nav-partners">
            <Partners compact />
          </div>
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

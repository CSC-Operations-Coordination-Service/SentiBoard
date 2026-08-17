import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Partners from "./Partners";

const LINKS = [
  { to: "/", label: "Index", end: true },
  { to: "/about", label: "About" },
  { to: "/acquisitions", label: "Acquisitions" },
  { to: "/events", label: "Events" },
  { to: "/availability", label: "Data Availability" },
  { to: "/processors", label: "Processors" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Below 760px the links become a sheet that overlays the page, so it has to be dismissed
  // as well as opened. Each link already closes it on click, but a route reached any other
  // way (browser back, a link inside the page) would otherwise leave the sheet covering the
  // destination.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={"nav" + (open ? " open" : "")}>
      <div className="nav-inner wrap">
        <Link to="/" className="brand" onClick={() => setOpen(false)} aria-label="SentiBoard — home">
          <img className="brand-logo" src="/assets/img/sentiboard.png" alt="SentiBoard" />
        </Link>
        <nav className="nav-links" id="nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-right">
          <div className="nav-partners"><Partners compact /></div>
          <ThemeToggle />
          <button
            className="nav-burger"
            aria-label={open ? "Close menu" : "Menu"}
            aria-expanded={open}
            aria-controls="nav-links"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  );
}

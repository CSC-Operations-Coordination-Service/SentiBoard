import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
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
  return (
    <header className={"nav" + (open ? " open" : "")}>
      <div className="nav-inner wrap">
        <Link to="/" className="brand" onClick={() => setOpen(false)} aria-label="SentiBoard — home">
          <img className="brand-logo" src="/assets/img/sentiboard.png" alt="SentiBoard" />
        </Link>
        <nav className="nav-links">
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
          <button className="nav-burger" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import "@/styles/footer.css";
import { ABOUT_CONTACT_EMAIL } from "@/data/about";

// Social profile URLs are not defined anywhere in the repo yet; replace the "#"
// placeholders with the real profile links before release.
const SOCIAL = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/sentinelonline/",
    viewBox: "0 0 24 24",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    label: "X",
    href: "https://x.com/sentinelonline_",
    viewBox: "0 0 24 24",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "Bluesky",
    href: "https://bsky.app/profile/sentinelonline.bsky.social",
    viewBox: "0 0 600 530",
    path: "M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 589.11-19.765 589.11 67.94c0 17.44-10 146.57-15.8 167.52-20.4 73.23-94.7 91.92-160.8 80.6 115.62 19.91 145 85.42 81.42 150.92-120.58 124.26-173.36-31.17-186.9-70.98-2.5-7.33-3.66-10.79-3.67-7.86 0-2.93-1.17.53-3.67 7.86-13.54 39.81-66.32 195.24-186.9 70.98-63.58-65.5-34.16-131 81.42-150.92-66.1 11.32-140.4-7.37-160.8-80.6C20 214.5 10 85.37 10 67.94 10-19.765 86.85 8.009 135.72 44.03z",
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <Link to="/" className="footer-logo" aria-label="SentiBoard home">
            <img src="/assets/img/sentiboard.png" alt="SentiBoard" />
          </Link>
          <nav className="footer-legal" aria-label="Legal">
            <Link to="/terms-conditions">Terms &amp; Conditions</Link>
            <span className="divider" aria-hidden="true" />
            <Link to="/cookie-notice">Cookie Notice</Link>
          </nav>
        </div>

        <div className="footer-grid">
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li>
                <Link to="/acquisitions-globe">Acquisitions Status</Link>
              </li>
              <li>
                <Link to="/events">Events</Link>
              </li>
              <li>
                <Link to="/availability">Data Availability</Link>
              </li>
              <li>
                <Link to="/processors">Processors</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Get in Touch</h4>
            <a className="footer-mail" href={`mailto:${ABOUT_CONTACT_EMAIL}`}>
              <Mail size={16} />
              <span>Mail</span>
            </a>
          </div>

          <div className="footer-col">
            <h4>Follow Us</h4>
            <div className="footer-social">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  title={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox={s.viewBox} aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-bot">
          <span>
            © {"2026"} Copernicus / ESA — Operated by the CSC Operations
            Coordination Service.
          </span>
          <span>SentiBoard v2 · UI mockup</span>
        </div>
      </div>
    </footer>
  );
}

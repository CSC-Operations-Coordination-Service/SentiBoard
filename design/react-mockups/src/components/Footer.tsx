import { Link } from "react-router-dom";
import Partners from "./Partners";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <div>
            <div className="brand" style={{ marginBottom: 14 }}>
              <img className="brand-logo" src="/assets/img/sentiboard.png" alt="SentiBoard" />
            </div>
            <p className="meta" style={{ lineHeight: 1.7, textTransform: "none", letterSpacing: 0 }}>
              The Copernicus Sentinel Operations Dashboard — a central point of access for events impacting
              data availability, real-time data collection insights, and key stats on products delivered.
            </p>
            <div className="partners-label meta">In partnership with</div>
            <Partners />
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/acquisitions">Acquisitions Status</Link>
            <Link to="/events">Events</Link>
            <Link to="/availability">Data Availability</Link>
            <Link to="/processors">Processors</Link>
          </div>
          <div>
            <h4>Information</h4>
            <Link to="/about">About &amp; FAQ</Link>
            <Link to="/news">Mission News</Link>
            <Link to="/terms-conditions">Terms &amp; Conditions</Link>
            <Link to="/cookie-notice">Cookie Notice</Link>
          </div>
        </div>
        <div className="footer-bot">
          <span>© {"2026"} Copernicus / ESA — Operated by the CSC Operations Coordination Service.</span>
          <span className="meta">SentiBoard v2 · UI mockup</span>
        </div>
      </div>
    </footer>
  );
}

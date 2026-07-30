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

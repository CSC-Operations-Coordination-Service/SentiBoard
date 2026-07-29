import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <div className="foot-brand-logos">
            <a href="https://www.copernicus.eu/" target="_blank" rel="noopener">
              <img src="/assets/img/copernicus_logo.png" alt="Copernicus" className="foot-cop-logo" />
            </a>
            <img src="/assets/img/sentiboard.png" alt="SentiBoard" className="foot-logo" />
          </div>
          <div className="foot-social">
            <a href="https://www.linkedin.com/company/sentinelonline/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.49 6 1.12 6 0 4.88 0 3.5 0 2.12 1.12 1 2.49 1 3.87 1 4.98 2.12 4.98 3.5zM.5 8h4V23h-4V8zm7 0h3.8v2.05h.05C11.9 8.9 13.3 8 15.3 8c4.1 0 4.9 2.7 4.9 6.2V23h-4v-7c0-1.7 0-3.8-2.3-3.8-2.3 0-2.7 1.8-2.7 3.7V23h-4V8z" /></svg></a>
            <a href="https://x.com/sentinelonline_" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24"><path d="M18.24 2.25h3.31l-7.23 8.26L23 21.75h-6.66l-5.22-6.82-5.97 6.82H1.84l7.73-8.84L1 2.25h6.83l4.72 6.24 5.69-6.24zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64z" /></svg></a>
            <a href="https://bsky.app/profile/sentinelonline.bsky.social" target="_blank" rel="noopener" aria-label="Bluesky"><svg viewBox="0 0 24 24"><path d="M12 10.8C10.6 8.2 6.9 3.6 3.6 3.6c-1.8 0-2.1 1.6-2.1 3.3 0 1.7.9 6.9 1.5 7.9.9 1.6 2.5 1.8 4 1.6-2.5.4-3.3 2.3-1.8 4.1 2.6 3.2 4.5-1.8 4.8-2.9.3 1.1 2.2 6.1 4.8 2.9 1.5-1.8.7-3.7-1.8-4.1 1.5.2 3.1 0 4-1.6.6-1 1.5-6.2 1.5-7.9 0-1.7-.3-3.3-2.1-3.3-3.3 0-7 4.6-8.4 7.2z" /></svg></a>
          </div>
        </div>
        <div className="foot-col">
          <h5>Quick Links</h5>
          <Link href="/v1/about">About</Link>
          <Link href="/v1/acquisitions">Acquisitions Status</Link>
          <Link href="/v1/events">Events</Link>
          <Link href="/v1/availability">Data Availability</Link>
          <Link href="/v1/processors">Processors</Link>
        </div>
        <div className="foot-col">
          <h5>Get in touch</h5>
          <a href="mailto:sentiboard@coordination-service.eu" className="foot-mail" aria-label="Email SentiBoard">
            <svg viewBox="0 0 24 24"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5v-13Zm2 .5 8 5 8-5H4Zm16 1.9-7.4 4.6a1 1 0 0 1-1.2 0L4 7.9V18h16V7.9Z" /></svg><span>Email us</span>
          </a>
          <Link href="/v1/terms-conditions">Terms &amp; Conditions</Link>
          <Link href="/v1/cookie-notice">Cookie Notice</Link>
        </div>
        <div className="foot-col foot-agencies">
          <div className="logos">
            <a href="https://www.esa.int" target="_blank" rel="noopener"><img src="/assets/img/esa_logo.png" alt="ESA" /></a>
            <a href="https://ec.europa.eu/info/index_en" target="_blank" rel="noopener"><img src="/assets/img/ec_logo_white.png" alt="European Commission" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

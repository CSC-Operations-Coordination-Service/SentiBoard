import RealtimeFeed from "@/components/RealtimeFeed";
import VerticalSlider from "@/components/VerticalSlider";
import NewsStatus from "@/components/NewsStatus";
import { getNews, getRealtimeEvents } from "@/lib/data";

// Server Component: data is fetched on the server and rendered to HTML.
// The browser never calls a JSON data API.
// Layout mirrors production (operations.dashboard.copernicus.eu): the hero band
// (News · Video · Real-time events), then the split vertical slider of modules.
export default async function Home() {
  const [news, rt] = await Promise.all([getNews(), getRealtimeEvents()]);
  // news / rt are { items, error }: error === true means the backend was unreachable.

  return (
    <>
      {/* 1 — hero: News (left) · Video (center) · Real-time events (right), like prod */}
      <section className="home-hero" id="hero-container">
        <div className="wrap hero-grid">
          {/* LEFT — Mission news (server-rendered) */}
          <aside className="hpanel reveal">
            <div className="ph"><h3>News</h3></div>
            <div className="news-list pbody">
              {news.error ? (
                <div className="pmsg err">⚠ Couldn’t load news — backend unavailable.</div>
              ) : news.items.length === 0 ? (
                <div className="pmsg">There are no news at the moment.</div>
              ) : (
                news.items.map((n) => (
                  <details className="nitem" key={n.id}>
                    <summary>
                      <div className="ntitle"><NewsStatus status={n.status} />{n.title}</div>
                      <div className="nmeta">
                        <span>{n.publicationDate}</span>
                      </div>
                    </summary>
                    <div className="nbody">
                      {n.text}
                      {n.link && (
                        <>
                          {" "}
                          <a href={n.link} target="_blank" rel="noopener" style={{ color: "var(--accent-cyan)" }}>Read more</a>
                        </>
                      )}
                    </div>
                  </details>
                ))
              )}
            </div>
          </aside>

          {/* CENTER — video + headline */}
          <div className="hero-center">
            <video autoPlay muted loop playsInline poster="/assets/img/home_preview.jpg">
              <source src="/assets/home_v4.mp4" type="video/mp4" />
            </video>
            <div className="veil" />
          </div>

          {/* RIGHT — real-time events (impacting anomalies, last 24h) */}
          <RealtimeFeed items={rt.items} error={rt.error} />
        </div>

        {/* scroll down to the modules */}
        <a href="#vertical-slider" className="chevron chevron-down" aria-label="Scroll to modules">
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </a>
      </section>

      {/* 2 — split vertical slider of modules */}
      <VerticalSlider />

      {/* back to top */}
      <a href="#hero-container" className="chevron chevron-up" aria-label="Back to top">
        <svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></svg>
      </a>
    </>
  );
}

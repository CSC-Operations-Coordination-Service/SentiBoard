export default function Stub({ title, note }: { title: string; note: string }) {
  return (
    <>
      <div className="page-head"><div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg> Home</a>
          <span className="sep">/</span><span className="cur">{title}</span>
        </nav>
        <h1>{title}</h1>
        <p>{note}</p>
      </div></div>
      <section className="wrap pad">
        <div className="panel reveal">
          <p style={{ color: "var(--muted)", margin: 0 }}>
            This page is being ported from the static mockup in <code>design/mockups/</code>.
            The layout, header, footer and design system are already in place — the page content
            will be built as a server component that fetches its data server-side.
          </p>
        </div>
      </section>
    </>
  );
}

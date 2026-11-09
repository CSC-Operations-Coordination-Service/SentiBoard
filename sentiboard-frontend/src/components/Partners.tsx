import { asset } from "@/lib/asset";

/* Official partner logos (ESA, European Commission, Copernicus), each linking to the organisation.
   The artwork swaps with the theme: white / EU-flag versions on dark, dark-on-white versions on
   light. Both are rendered and CSS shows the right one (src/styles/shell.css), so this is a server
   component and the logos are right on first paint. Copernicus has no light-background variant:
   its white artwork is darkened by a filter in light mode. */

// h = height in dark mode; hLight overrides it in light mode (the light-background ESA/EC artwork
// carries extra internal whitespace, so it needs a larger box to read at the same visual size).
interface Partner {
  href: string;
  alt: string;
  dark: string;
  light: string | null;
  h: number;
  hLight?: number;
}

const PARTNERS: Partner[] = [
  { href: "https://www.esa.int/", alt: "ESA — European Space Agency",
    dark: asset("/assets/img/esa_logo.png"), light: asset("/assets/img/ESA_Logo_white.png"), h: 30, hLight: 46 },
  { href: "https://ec.europa.eu/info/index_en", alt: "European Commission",
    dark: asset("/assets/img/ec_logo_white.png"), light: asset("/assets/img/ec_logo_white_.png"), h: 34, hLight: 40 },
  { href: "https://www.copernicus.eu/", alt: "Copernicus",
    dark: asset("/assets/img/copernicus_logo.png"), light: null, h: 22 },
];

export default function Partners({ compact = false }: { compact?: boolean }) {
  const scale = compact ? 0.72 : 1;
  const px = (h: number) => Math.round(h * scale);

  return (
    <div className={"partners" + (compact ? " compact" : "")}>
      {PARTNERS.map((p) => (
        <a key={p.href} href={p.href} target="_blank" rel="noopener noreferrer"
          className="partner-logo-link" title={p.alt}>
          {/* Small fixed-height logos; next/image would add a wrapper and nothing else. */}
          {p.light ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dark} alt={p.alt} className="sb-dark-only" style={{ height: px(p.h) }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.light} alt={p.alt} className="sb-light-only"
                style={{ height: px(p.hLight ?? p.h) }} />
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.dark} alt={p.alt} className="sb-darken-on-light" style={{ height: px(p.h) }} />
          )}
        </a>
      ))}
    </div>
  );
}

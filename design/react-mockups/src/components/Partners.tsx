import { useTheme } from "@/theme";

// Official partner logos, matching the current app (ESA, European Commission,
// Copernicus), each linking to the organisation. We theme-swap the artwork:
//   dark theme  → white / EU-flag versions on transparent
//   light theme → dark-on-white versions supplied for light backgrounds
// Copernicus has no light-background variant yet, so in light mode its white
// artwork is darkened with a filter (see `.needs-dark` in global.css).

// h = height in dark mode; hLight overrides it in light mode (the light-background
// ESA/EC artwork carries extra internal whitespace, so it needs a larger box to
// read at the same visual size as the others).
interface Partner { href: string; alt: string; dark: string; light: string | null; h: number; hLight?: number; }

const PARTNERS: Partner[] = [
  { href: "https://www.esa.int/", alt: "ESA — European Space Agency",
    dark: "/assets/img/esa_logo.png", light: "/assets/img/ESA_Logo_white.png", h: 30, hLight: 46 },
  { href: "https://ec.europa.eu/info/index_en", alt: "European Commission",
    dark: "/assets/img/ec_logo_white.png", light: "/assets/img/ec_logo_white_.png", h: 34, hLight: 40 },
  { href: "https://www.copernicus.eu/", alt: "Copernicus",
    dark: "/assets/img/copernicus_logo.png", light: null, h: 22 },
];

export default function Partners({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();
  const light = theme === "light";
  const scale = compact ? 0.72 : 1;

  return (
    <div className={"partners" + (compact ? " compact" : "")}>
      {PARTNERS.map((p) => {
        const src = light && p.light ? p.light : p.dark;
        const noLight = light && !p.light; // Copernicus in light mode → darken
        const baseH = light && p.hLight ? p.hLight : p.h;
        return (
          <a key={p.href} href={p.href} target="_blank" rel="noopener noreferrer"
            className="partner-logo-link" title={p.alt}>
            <img src={src} alt={p.alt} className={noLight ? "needs-dark" : ""}
              style={{ height: Math.round(baseH * scale) }} />
          </a>
        );
      })}
    </div>
  );
}

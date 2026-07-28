import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

// Reusable module card — icon + title + the module's canonical description over a
// module image. Reuses the same Lucide glyph + token system as EventIcon / FilterBar
// so it reads as part of the design system. The `desc` text comes from the canonical
// About copy (src/data/about.ts), so the card is the module part of that text, not a
// separate/paraphrased blurb.
export interface Feature {
  href: string;
  title: string;
  desc: string;
  img: string;
  Icon: LucideIcon;
}

export default function FeatureCard({ f }: { f: Feature }) {
  return (
    <Link className="feature-card" to={f.href}>
      <div className="fc-media">
        <img src={f.img} alt="" loading="lazy" />
        <span className="fc-icon"><f.Icon size={20} strokeWidth={1.9} aria-hidden /></span>
      </div>
      <div className="fc-body">
        <h3>{f.title}</h3>
        <p className="fc-desc">{f.desc}</p>
        <span className="fc-go">Open module <span className="arrow">→</span></span>
      </div>
    </Link>
  );
}

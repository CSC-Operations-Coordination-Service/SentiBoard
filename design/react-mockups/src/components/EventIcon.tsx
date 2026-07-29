import { SatelliteDish, Compass, Joystick, Cog, Satellite, type LucideIcon } from "lucide-react";
import type { IssueType } from "@/data/mock";

// Event-type icons from Lucide — thin, consistent line glyphs that suit the
// restrained "mission-control" aesthetic. Rendered with currentColor so they
// inherit the colour the context sets (type colour on chips/calendar, dark on
// filled chips).
const ICONS: Record<IssueType, LucideIcon> = {
  acquisition: SatelliteDish, // ground-station downlink / sensing
  calibration: Compass,       // calibration (matches current app's compass)
  manoeuvre: Joystick,        // manoeuvre (matches current app's joystick)
  production: Cog,            // product processing
  satellite: Satellite,       // spacecraft anomaly
};

export default function EventIcon({ type, size = 15 }: { type: IssueType; size?: number }) {
  const Icon = ICONS[type];
  return <Icon size={size} strokeWidth={1.9} aria-hidden />;
}

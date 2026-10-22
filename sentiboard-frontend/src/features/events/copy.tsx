/* Page copy, SEO metadata and the collapsible description panel for the Events & Anomalies page.
   SEO metadata ported from the legacy app (apps/routes/home/routes.py PAGE_METADATA on main). */

import {
  Cog,
  Compass,
  HelpCircle,
  Joystick,
  Satellite,
  SatelliteDish,
} from "lucide-react";

/** Collapsible description panel content, ported from the prototype's EventsManifest. */
export function EventsDescription() {
  const items = [
    {
      key: "Acquisition",
      Icon: SatelliteDish,
      color: "#aeb8c4",
      text: "issue occurring during the reception of the data at the ground station",
    },
    {
      key: "Calibration",
      Icon: Compass,
      color: "#b0dfe5",
      text: "issue occurred during sensor calibration",
    },
    {
      key: "Manoeuvre",
      Icon: Joystick,
      color: "#ffad00",
      text: "issue occurred during the execution of a manoeuvre",
    },
    {
      key: "Production",
      Icon: Cog,
      color: "#c77dff",
      text: "issue occurred during data processing",
    },
    {
      key: "Satellite",
      Icon: Satellite,
      color: "#ee8216",
      text: "issue due to instrument or platform unavailability",
    },
    {
      key: "Other",
      Icon: HelpCircle,
      color: "#a0a0a0",
      text: "other events not classified in the above categories",
    },
  ] as const;

  return (
    <>
      <p>
        This view shows the events occurred on a given date and the possible
        impact on user products completeness. Events are categorized according
        to the following issue types:
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0" }}>
        {items.map(({ key, Icon, color, text }) => (
          <li
            key={key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              margin: "0.35rem 0",
            }}
          >
            <span
              style={{
                color,
                display: "flex",
                alignItems: "center",
                height: "1.6em",
                flexShrink: 0,
              }}
            >
              <Icon aria-hidden size={14} strokeWidth={1.9} />
            </span>
            <span>
              <strong style={{ color }}>{key}:</strong> {text}
            </span>
          </li>
        ))}
      </ul>
      <p>
        Clicking a star flies into that day and lists the datatakes it
        potentially impacted, determined by their sensing times, along with
        further details about the event. The impact on datatake completeness is
        given by the coloured dot beside each datatake: green when the total
        completeness is spared, orange in case of medium impact, red when the
        datatake is lost.
      </p>
    </>
  );
}

export const EVENTS_TITLE = "Events";
export const EVENTS_SUBTITLE =
  "Every occurrence across the constellation, mapped onto the datatakes it puts at risk. Pick a day to inspect its events, their origin and the completeness they cost.";
export const EVENTS_HERO_IMG = "/assets/img/modules/events.jpg";

export const SEO = {
  title: "Copernicus Sentinel Events & Anomalies | Mission Calendar",
  description:
    "Track Copernicus Sentinel satellite events and anomalies on an interactive calendar. " +
    "Browse acquisitions, calibrations, manoeuvres and platform incidents for Sentinel-1, -2, -3 and -5P, " +
    "with their impact on datatake completeness.",
  keywords: [
    "Copernicus Sentinel events calendar",
    "ESA Sentinel anomalies",
    "Sentinel satellite incidents",
    "Sentinel datatake completeness events",
    "Copernicus mission events",
    "Sentinel-1 anomalies",
    "Sentinel acquisition events",
  ],
};

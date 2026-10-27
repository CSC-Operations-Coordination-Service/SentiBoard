/* Home page copy — MODULES and FAQ_GROUPS, verbatim from the prototype ref §5/§7.
   Long panel texts are JSX (no dangerouslySetInnerHTML). */

import type { ReactNode } from "react";
import { ROUTES } from "@/lib/routes";

export interface Module {
  href: string;
  title: string;
  img: string;
  pos?: string;
  desc: string;
  long: ReactNode;
}

export const MODULES: Module[] = [
  {
    href: ROUTES.acquisitionsGlobe.path,
    title: "Acquisitions Status",
    img: "/assets/img/modules/acquisitions.jpg",
    desc: "Past, current and planned Sentinel acquisitions on an interactive 3D globe.",
    long: (
      <>
        The <b>Acquisitions Status</b> view displays the past, current and future Copernicus
        Sentinels&apos; acquisition on an interactive, 3D globe. Through this view, users can either
        inspect the status of a past acquisition, or learn about the planned acquisitions for the
        mission of interest. By default, the real-time sensing scenario is displayed.
      </>
    ),
  },
  {
    href: ROUTES.events.path,
    title: "Events",
    img: "/assets/img/modules/events.jpg",
    desc: "Calibration activities, manoeuvres and anomalies that could impede data production.",
    long: (
      <>
        The <b>Events</b> page provides details of the events over the past three months that could
        impede data production, such as planned calibration activities, manoeuvres, or anomalies.
        Information on the extent to which these events affect data production and the data products
        impacted is provided.
      </>
    ),
  },
  {
    href: ROUTES.availability.path,
    title: "Data Availability",
    img: "/assets/img/modules/availability.jpg",
    desc: "Real-time list of available collections delivered by the missions, with key metrics.",
    long: (
      <>
        The <b>Data Availability</b> section of the dashboard hosts a real-time list of available
        collections delivered by the missions, enabling users to scan through these products to find
        data that meet their research and development requirements, to verify whether specific data
        of interest is available, check its current status and review key availability metrics such
        as availability percentage.
      </>
    ),
  },
  {
    href: ROUTES.processors.path,
    title: "Processors",
    img: "/assets/img/modules/processors.jpg",
    desc: "The complete list of Copernicus Sentinel processor releases on an interactive timeline.",
    long: (
      <>
        The <b>Processors</b> tab shows the complete list of the releases of the Copernicus
        Sentinels processors, on an interactive timeline. The timeline can be zoomed in / out using
        the mouse wheel, and dragged to the left / right by moving the mouse while keeping left-hand
        button pressed. By clicking on a coloured box, the details relevant to the selected
        processor release is displayed in the lower part of the screen.
      </>
    ),
  },
];

export interface FaqItem {
  q: string;
  a: ReactNode;
}

export interface FaqGroup {
  icon: ReactNode;
  title: string;
  items: FaqItem[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    title: "General Information",
    items: [
      {
        q: "What is the SentiBoard?",
        a: "A central point of access for events impacting data availability, real-time data collection insights and key statistics on the products delivered by the Copernicus Sentinel missions.",
      },
      {
        q: "Who operates the dashboard?",
        a: "It is operated by the CSC Operations Coordination Service, as part of the ongoing transformation of the Copernicus Ground Segment.",
      },
    ],
  },
  {
    icon: (
      <>
        <path d="M4 13l7-7M8 17l7-7" />
        <rect x="2" y="9" width="5" height="5" rx="1" transform="rotate(-45 4.5 11.5)" />
        <rect x="17" y="9" width="5" height="5" rx="1" transform="rotate(-45 19.5 11.5)" />
        <path d="M14 18l4 4" />
      </>
    ),
    title: "Sentinel Missions Monitoring",
    items: [
      {
        q: "Which missions are covered?",
        a: "Sentinel-1, Sentinel-2, Sentinel-3 and Sentinel-5P, including every satellite currently in operations or in commissioning.",
      },
      {
        q: "Can I see planned acquisitions?",
        a: "Yes. The Acquisitions Status globe shows past, current and planned acquisitions; by default the real-time sensing scenario is displayed.",
      },
    ],
  },
  {
    icon: (
      <>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    title: "Data & Product Availability",
    items: [
      {
        q: "How is availability calculated?",
        a: "As published volume over expected sensing, computed per product type and aggregated by processing level.",
      },
      {
        q: "A product I need is missing. Why?",
        a: "Check the Events page first: a calibration activity, manoeuvre or ground-segment issue in the same window usually explains the gap.",
      },
    ],
  },
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </>
    ),
    title: "Navigation & Features",
    items: [
      {
        q: "How do I use the processor timeline?",
        a: "Zoom in and out with the mouse wheel and drag left or right keeping the left button pressed. Clicking a coloured box opens the details of that release.",
      },
      {
        q: "Can I filter by mission?",
        a: "Every module carries its own filters: mission, satellite, day of acquisition and datatake, applied in cascade.",
      },
    ],
  },
  {
    icon: (
      <>
        <path d="M14.7 6.3a4 4 0 0 0 5 5L21 14l-7 7-4-4 7-7z" />
        <path d="M9 15l-5 5" />
      </>
    ),
    title: "Troubleshooting",
    items: [
      {
        q: "The 3D globe does not render.",
        a: "The globe needs WebGL. Update your browser or enable hardware acceleration, then reload the page.",
      },
      {
        q: "Figures look out of date.",
        a: "A cached page is the usual cause. Force a reload; if the timestamp in the header stays behind, report it to the contact address below.",
      },
    ],
  },
  {
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
    title: "Contact & Support",
    items: [
      {
        q: "How do I report an anomaly?",
        a: (
          <>
            Write to{" "}
            <a href="mailto:sentiboard@coordination-service.eu?subject=SentiBoard%20anomaly%20report">
              sentiboard@coordination-service.eu
            </a>{" "}
            with the mission, the datatake identifier and the time window involved.
          </>
        ),
      },
      {
        q: "Can I request a new feature?",
        a: "Yes. Feature requests are collected and reviewed with the Copernicus Ground Segment evolution plan.",
      },
    ],
  },
];

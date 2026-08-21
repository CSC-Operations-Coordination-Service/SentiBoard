/* Canonical About-page FAQ copy.
 *
 * Lifted VERBATIM from pages/AboutRedesign.tsx so the two new About concepts
 * (Systems Briefing, Mission Dossier) show exactly the same answers as the
 * existing proposal — the concepts differ in layout, never in wording, the same
 * rule data/about.ts states for the intro text.
 *
 * The real /about and /examples/about still hold their own local copies; those
 * pages are deliberately untouched, so this module is not wired into them. */

import { ABOUT_CONTACT_EMAIL } from "./about";

export interface AboutFaqGroup { group: string; items: [string, string][]; }

export const ABOUT_FAQS: AboutFaqGroup[] = [
  {
    group: "General Information", items: [
      ["What is the SentiBoard?", "The Operations Dashboard provides real-time and historical insights into data availability and the processor baseline. It's intended for users who want an overview of satellite data flows."],
      ["Who can use the Dashboard?", "It is publicly accessible and designed for technical users, scientists, policymakers, and service operators interested in mission performance and service continuity."],
    ],
  },
  {
    group: "Sentinel Missions Monitoring", items: [
      ["What kind of mission data is displayed?", "The dashboard shows the operational status of Sentinel satellites (e.g., Sentinel-1A/B, -2A/B, -3A/B, -5P), including acquisition planning, data availability, and processors baseline."],
      ["How frequently is data updated?", "Most data is updated daily or in near real-time, depending on the subsystem (e.g., acquisitions, ground segment performance, data availability)."],
    ]
  },
  {
    group: "Data & Product Availability", items: [
      ["What product metrics can I view?", "Statistics on availability, completeness, latency, timeliness, and throughput for each Sentinel mission — enough to evaluate performance against service-level expectations."],
      ["How frequently is data updated?", "Most data is updated daily or in near real-time, depending on the subsystem (acquisitions, ground-segment performance, data availability)."],
    ],
  },
  {
    group: "Navigation & Features", items: [
      ["How do I find specific data?", "To locate specific data, use the top navigation menu of the dashboard. The Acquisitions Status section presents past, current, and planned Copernicus Sentinel acquisitions on an interactive 3D globe. Events provides recent information about activities that may affect data production, such as manoeuvres or anomalies. In Data Availability, you'll find real-time access to delivered data collections, including Detail Data Availability and Global Data Availability views. These help users browse and assess products according to their research needs. Finally, the Processors tab features an interactive timeline of Sentinel processor releases, allowing detailed inspection of each version. This timeline works in conjunction with the left-hand panel, where you can filter the data by mission (e.g., Sentinel-2). As you explore the timeline and filtered data, hovering over the graphs reveals tooltips with precise values and timestamps, providing a seamless, detailed view of processor updates."],
      ["Can I export the charts or data?", "While there's no dedicated export button, screenshots and browser-based print/save tools can be used. For bulk or raw data, refer to the Data Space Ecosystem."],
    ]
  },
  {
    group: "Troubleshooting", items: [
      ["Why is some data missing or flatlined?", "Gaps may reflect planned maintenance, satellite anomalies, or delays in ground segment reporting. These are often documented in the Sentinel news feed."],
      ["The dashboard is not loading—what should I do?", "First, ensure your browser allows scripts and cookies. If problems persist, try clearing your cache or switching to another browser. There is no login requirement for general access."],
    ]
  },
  {
    group: "Contact & Support", items: [
      ["How can I report a bug or request help?", `For dashboard support, including data access and operational issues, contact us at ${ABOUT_CONTACT_EMAIL}.`],
    ],
  },
];

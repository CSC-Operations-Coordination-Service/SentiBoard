// Canonical "About" copy — the exact wording that must appear, verbatim, in the
// first section of EVERY About page (the real /about and every /examples proposal).
// Centralised here so the text stays identical across all versions; pages differ
// only in how they lay this text out, never in what it says.

export const ABOUT_INTRO: string[] = [
  "Copernicus is the European Union's Earth observation programme, looking at our planet and its environment to benefit all European citizens. This initiative is headed by the European Commission (EC) in partnership with the European Space Agency (ESA).",
  "The EOF-CSC (Earth Observation Framework - Copernicus Space Component) managed by ESA encompass all necessary activities to plan the observations performed by the Sentinel satellites, acquire the data on ground, process the satellite data stream into user level products, ensure the preservation of the essential mission data as well as the availability of an open and free access to the user data in line with the Copernicus Data Policy.",
  "The Copernicus Operations Dashboard facilitates research and development activities by providing a central point of access for details of events impacting data availability, real-time data collection insights, and key stats on products delivered:",
];

export interface AboutModule { href: string; title: string; desc: string; }

// The four module descriptions are PART of the canonical text above (they follow
// the colon). A version may render them as prose, links or cards — but the wording
// is fixed here.
export const ABOUT_MODULES: AboutModule[] = [
  {
    href: "/acquisitions", title: "Acquisitions Status",
    desc: "The Acquisitions Status view displays the past, current and future Copernicus Sentinels' acquisition on an interactive, 3D globe. Through this view, users can either inspect the status of a past acquisition, or learn about the planned acquisitions for the mission of interest. By default, the real-time sensing scenario is displayed.",
  },
  {
    href: "/events", title: "Events",
    desc: "The Events page provides details of the events over the past three months that could impede data production, such as planned calibration activities, manoeuvres, or anomalies. Information on the extent to which these events affect data production and the data products impacted is provided.",
  },
  {
    href: "/availability", title: "Data Availability",
    desc: "The Data Availability section of the dashboard hosts a real-time list of available collections delivered by the missions, enabling users to scan through these products to find data that meet their research and development requirements, to verify whether specific data of interest is available, check its current status and review key availability metrics such as availability percentage.",
  },
  {
    href: "/processors", title: "Processors",
    desc: "The Processors tab shows the complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged to the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a colored box, the details relevant to the selected processor release is displayed in the lower part of the screen.",
  },
];

export const ABOUT_OUTRO = "Its development forms part of the ongoing transformation of the Copernicus Ground Segment, which is laying the foundations for the planned expansion of the Copernicus Programme and ensuring the rapid and flexible delivery of high-quality data for decades to come.";

export const ABOUT_CONTACT_EMAIL = "sentiboard@coordination-service.eu";

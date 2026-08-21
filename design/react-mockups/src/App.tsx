import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Acquisitions from "./pages/Acquisitions";
import Events from "./pages/Events";
import Availability from "./pages/Availability";
import Processors from "./pages/Processors";
import About from "./pages/About";
import { NotFoundPage, StatPage } from "./pages/Simple";
import { ExamplesHome, IndexFleet, IndexGallery, IndexReveal } from "./pages/IndexExamples";
import AboutRedesign from "./pages/AboutRedesign";
import AboutBriefing from "./pages/about-briefing/AboutBriefing";
import AboutDossier from "./pages/about-dossier/AboutDossier";
import EventsManifest from "./pages/events-manifest/EventsManifest";
import EventsSwimlanes from "./pages/events-swimlanes/EventsSwimlanes";
import EventsSpaceXConcepts from "./components/EventsSpaceXConcepts";
import AcquisitionsGlobe from "./pages/AcquisitionsGlobe";
import AcquisitionsLadder from "./pages/acquisitions-ladder/AcquisitionsLadder";
import DataAvailability from "./pages/DataAvailability";
import DataAvailabilitySpaceX from "./pages/DataAvailabilitySpaceX";
import CoverageTimeline from "./pages/coverage-timeline/CoverageTimeline";
import VersionMatrix from "./pages/version-matrix/VersionMatrix";
import ReleaseLog from "./pages/release-log/ReleaseLog";
import VersionCompare from "./pages/version-compare/VersionCompare";
import CookieNotice from "./pages/CookieNotice";
import TermsConditions from "./pages/TermsConditions";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/acquisitions" element={<Acquisitions />} />
          <Route path="/events" element={<Events />} />
          <Route path="/availability" element={<Availability />} />
          <Route path="/processors" element={<Processors />} />
          <Route path="/about" element={<About />} />

          {/* PROPOSAL examples (do not affect the real pages above) */}
          <Route path="/examples" element={<ExamplesHome />} />
          <Route path="/examples/fleet" element={<IndexFleet />} />
          <Route path="/examples/gallery" element={<IndexGallery />} />
          <Route path="/examples/reveal" element={<IndexReveal />} />
          <Route path="/examples/about" element={<AboutRedesign />} />
          <Route path="/examples/about-briefing" element={<AboutBriefing />} />
          <Route path="/examples/about-dossier" element={<AboutDossier />} />
          <Route path="/examples/events-manifest" element={<EventsManifest />} />
          <Route path="/examples/events-spacex" element={<EventsSpaceXConcepts />} />
          <Route path="/examples/events-swimlanes" element={<EventsSwimlanes />} />
          <Route path="/examples/acquisitions-globe" element={<AcquisitionsGlobe />} />
          <Route path="/examples/acquisitions-ladder" element={<AcquisitionsLadder />} />
          <Route path="/examples/data-availability" element={<DataAvailability />} />
          <Route path="/examples/data-availability-spacex" element={<DataAvailabilitySpaceX />} />
          <Route path="/examples/coverage-timeline" element={<CoverageTimeline />} />
          <Route path="/examples/version-matrix" element={<VersionMatrix />} />
          <Route path="/examples/release-log" element={<ReleaseLog />} />
          <Route path="/examples/version-compare" element={<VersionCompare />} />

          {/* Remaining functional pages — styled placeholders carrying the real feature copy */}
          <Route path="/product-timeliness" element={<StatPage crumb="Product Timeliness" title="Product Timeliness"
            sub="Timeliness of Sentinel product publication against service-level targets, per mission and product type, over the last three months."
            kpis={[["Within target", "96.2", "%"], ["Median latency", "48", "min"], ["Breaches (7d)", "3", ""], ["Products / day", "18.4", "k"]]} />} />
          <Route path="/publication-statistics" element={<StatPage crumb="Publication Statistics" title="Publication Statistics"
            sub="Volumes and completeness of products published to the Copernicus Data Space Ecosystem, broken down by mission, level and timeliness class."
            kpis={[["Published (24h)", "1.28", "M"], ["Completeness", "98.4", "%"], ["Missions", "5", ""], ["Product levels", "12", ""]]} />} />
          <Route path="/data-archive" element={<StatPage crumb="Data Archive" title="Data Archive"
            sub="Long-term archive holdings and preservation status for the essential mission data across the Copernicus Sentinel constellation."
            kpis={[["Total holdings", "184", "PB"], ["Datatakes", "42.9", "M"], ["Missions", "5", ""], ["Availability", "99.99", "%"]]} />} />
          <Route path="/space-segment" element={<StatPage crumb="Space Segment" title="Space Segment"
            sub="Real-time status of the in-orbit Copernicus Sentinel satellites, including operational mode, instruments and orbital parameters."
            kpis={[["Satellites", "8", ""], ["Nominal", "7", ""], ["Degraded", "1", ""], ["Constellations", "5", ""]]} />} />
          <Route path="/data-access" element={<StatPage crumb="Data Access" title="Data Access"
            sub="Global and detailed data-access performance for the Copernicus Data Space Ecosystem download and streaming services."
            kpis={[["Uptime (30d)", "99.95", "%"], ["Avg throughput", "3.2", "GB/s"], ["Active nodes", "6", ""], ["Requests / day", "9.1", "M"]]} />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/cookie-notice" element={<CookieNotice />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <div className="page-head"><div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/v1"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg> Home</a>
          <span className="sep">/</span><span className="cur">About</span>
        </nav>
        <h1>About SentiBoard</h1>
      </div></div>

      <section className="wrap pad">
        <div className="about-intro reveal">
          <div id="about-text">
            <p className="lead">Copernicus is the European Union&apos;s Earth observation programme, looking at our planet and its environment to benefit all European citizens. This initiative is headed by the European Commission (EC) in partnership with the European Space Agency (ESA).</p>
            <p>The EOF-CSC (Earth Observation Framework - Copernicus Space Component) managed by ESA encompass all necessary activities to plan the observations performed by the Sentinel satellites, acquire the data on ground, process the satellite data stream into user level products, ensure the preservation of the essential mission data as well as the availability of an open and free access to the user data in line with the Copernicus Data Policy.</p>
            <p>The Copernicus Operations Dashboard facilitates research and development activities by providing a central point of access for details of events impacting data availability, real-time data collection insights, and key stats on products delivered:</p>
          </div>
        </div>
      </section>

      <section className="wrap pad">
        <div className="about-modules">
          <Link className="card reveal" href="/v1/acquisitions">
            <h3>Acquisitions Status</h3>
            <p>The Acquisitions Status view displays the past, current and future Copernicus Sentinels&apos; acquisition on an interactive, 3D globe. Through this view, users can either inspect the status of a past acquisition, or learn about the planned acquisitions for the mission of interest. By default, the real-time sensing scenario is displayed.</p>
          </Link>
          <Link className="card reveal" href="/v1/events">
            <h3>Events</h3>
            <p>The Events page provides details of the events over the past three months that could impede data production, such as planned calibration activities, manoeuvres, or anomalies. Information on the extent to which these events affect data production and the data products impacted is provided.</p>
          </Link>
          <Link className="card reveal" href="/v1/availability">
            <h3>Data Availability</h3>
            <p>The Data Availability section of the dashboard hosts a real-time list of available collections delivered by the missions, enabling users to scan through these products to find data that meet their research and development requirements, to verify whether specific data of interest is available, check its current status and review key availability metrics such as availability percentage.</p>
          </Link>
          <Link className="card reveal" href="/v1/processors">
            <h3>Processors</h3>
            <p>The Processors tab shows the complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged to the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a colored box, the details relevant to the selected processor release is displayed in the lower part of the screen.</p>
          </Link>
        </div>
      </section>

      <section className="wrap pad" id="faq">
        <div className="section-head reveal"><div><h2>FAQs</h2></div><span className="meta">CLICK TO EXPAND</span></div>
        <div className="reveal">
          <div className="faq-group">
            <div className="gtitle">General Information</div>
            <details className="faq"><summary>What is the SentiBoard? <span className="chev">+</span></summary><div className="ans">The Operations Dashboard provides real-time and historical insights into the data availability and the processors baseline. It&apos;s intended for users who want an overview of satellite data flows. See the general explanation <a href="#about-text">here</a>.</div></details>
            <details className="faq"><summary>Who can use the Dashboard? <span className="chev">+</span></summary><div className="ans">It is publicly accessible and designed for technical users, scientists, policymakers, and service operators interested in mission performance and service continuity.</div></details>
          </div>
          <div className="faq-group">
            <div className="gtitle">Sentinel Missions Monitoring</div>
            <details className="faq"><summary>What kind of mission data is displayed? <span className="chev">+</span></summary><div className="ans">The dashboard shows the operational status of Sentinel satellites (e.g., Sentinel-1A/B, -2A/B, -3A/B, -5P), including acquisition planning, data availability, and processors baseline.</div></details>
            <details className="faq"><summary>How frequently is data updated? <span className="chev">+</span></summary><div className="ans">Most data is updated daily or in near real-time, depending on the subsystem (e.g., acquisitions, ground segment performance, data availability).</div></details>
          </div>
          <div className="faq-group">
            <div className="gtitle">Data &amp; Product Availability</div>
            <details className="faq"><summary>What product metrics can I view? <span className="chev">+</span></summary><div className="ans">You can access statistics on data availability, completeness, latency, timeliness, and throughput for each Sentinel mission. These metrics help evaluate performance against service-level expectations.</div></details>
            <details className="faq"><summary>Can I see long-term trends? <span className="chev">+</span></summary><div className="ans">Yes. You can explore interactive graphs that span days, months, or years, with filtering options by mission, instrument, and product type. The available time span is three months.</div></details>
          </div>
          <div className="faq-group">
            <div className="gtitle">Navigation &amp; Features</div>
            <details className="faq"><summary>How do I find specific data? <span className="chev">+</span></summary><div className="ans">To locate specific data, use the top navigation menu of the dashboard. The Acquisitions Status section presents past, current, and planned Copernicus Sentinel acquisitions on an interactive 3D globe. Events provides recent information about activities that may affect data production, such as manoeuvres or anomalies. In Data Availability, you&apos;ll find real-time access to delivered data collections, including Detail Data Availability and Global Data Availability views. These help users browse and assess products according to their research needs. Finally, the Processors tab features an interactive timeline of Sentinel processor releases, allowing detailed inspection of each version. This timeline works in conjunction with the left-hand panel, where you can filter the data by mission (e.g., Sentinel-2). As you explore the timeline and filtered data, hovering over the graphs reveals tooltips with precise values and timestamps, providing a seamless, detailed view of processor updates.</div></details>
            <details className="faq"><summary>Can I export the charts or data? <span className="chev">+</span></summary><div className="ans">While there&apos;s no dedicated export button, screenshots and browser-based print/save tools can be used. For bulk or raw data, refer to the Data Space Ecosystem.</div></details>
          </div>
          <div className="faq-group">
            <div className="gtitle">Troubleshooting</div>
            <details className="faq"><summary>Why is some data missing or flatlined? <span className="chev">+</span></summary><div className="ans">Gaps may reflect planned maintenance, satellite anomalies, or delays in ground segment reporting. These are often documented in the Sentinel news feed.</div></details>
            <details className="faq"><summary>The dashboard is not loading—what should I do? <span className="chev">+</span></summary><div className="ans">First, ensure your browser allows scripts and cookies. If problems persist, try clearing your cache or switching to another browser. There is no login requirement for general access.</div></details>
          </div>
          <div className="faq-group">
            <div className="gtitle">Contact &amp; Support</div>
            <details className="faq"><summary>How can I report a bug or request help? <span className="chev">+</span></summary><div className="ans">For dashboard support, including data access and operational issues, please contact us at <a href="mailto:sentiboard@coordination-service.eu">sentiboard@coordination-service.eu</a>.</div></details>
          </div>
        </div>
      </section>

      <section className="wrap pad">
        <div className="contact reveal">
          <div>
            <h3>Get in touch</h3>
            <p>For any inquiries on the Copernicus Sentinel Operations Dashboard contact sentiboard@coordination-service.eu.</p>
          </div>
          <a className="btn primary" href="mailto:sentiboard@coordination-service.eu">Contact the team <span className="arrow">→</span></a>
        </div>
      </section>
    </>
  );
}

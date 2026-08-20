import { useState } from "react";
import { PageHeader, Reveal } from "@/components/ui";

// Cookie Notice — the real ESA legal copy, carried over verbatim from the Next.js app
// (frontend/app/v1/cookie-notice/page.tsx). Kept as one HTML string for the same reason it is
// there: it is a legal text that gets replaced wholesale, not authored as components. The string
// is split around the opt-in/out control so that control can be a real React component here
// instead of the DOM-listener shim the Next.js page uses.
const BODY_TOP = `
<h2>ESA Privacy Notice</h2>
<p>Your personal data are collected and further processed for the performance of public service tasks related to ESA's mission under the ESA Convention, including for ESA for the purposes of communication activities, such as sending e-mails and invitations (this entails the management of contact lists for correspondence), for statistical and analytical purposes and, generally, for the promotion of ESA's activities, programmes and initiatives.</p>
<p>In particular, Your personal data are collected and further processed:</p>
<ul>
  <li>to inform and raise awareness among the general public in particular in ESA Member States;</li>
  <li>to perform qualitative media monitoring;</li>
  <li>to conduct analytics with the aim to raise awareness or to conduct surveys on topics related to space activities, programmes, initiatives and to ESA missions, programmes and activities;</li>
  <li>to analyse and monitor Your interactions with the website, including monitoring and analysis of website use, traffic and interactions;</li>
  <li>to deal with your current and future queries or requests submitted via website(s) or to otherwise engage with you;</li>
  <li>to analyse and monitor Your reactions to ESA activities, programmes and initiatives as well as to various posts, statements or declarations made in connection with space activities, programmes, and initiatives, in particular to optimise Our communication and Your engagement on websites;</li>
  <li>to provide optimised data flow between target environments in an automated manner;</li>
  <li>to ensure audience measurement;</li>
  <li>to grant a user access to specific functionalities of the website that require authentication;</li>
  <li>to better understand the needs and the browsing experience of ESA website visitors;</li>
  <li>to gather statistics with a view to improving our communication and to enhance the user experience;</li>
  <li>to identify and track unauthorised access or any attempts to access our servers without permission;</li>
  <li>to provide and as applicable to discontinue Your access to the IT infrastructure, tools and services operated by or on behalf of ESA;</li>
  <li>to provide access and proper performance of the service to end-users;</li>
  <li>to provide support services and to ensure the management and maintenance of the service;</li>
  <li>to enable ESA to perform actions in connection with identity and access management, incident prevention, management or reporting;</li>
  <li>to ensure data subject rights management;</li>
  <li>to defend the Agency from possible liability claims that may arise in connection with Your use;</li>
  <li>to ensure personal data quality and accuracy;</li>
  <li>to defend ESA's rights and interests, including to defend ESA from possible liability claims that may arise in connection with Our communication activities.</li>
</ul>
<p>When using ESA websites You may find information (such as links to third-party websites) governed by separate terms and conditions. In Your voluntary registration for and use such third-party websites, their applicable terms and conditions and privacy policies apply, and ESA has no control thereof. The use of third-party websites accessible via information present on ESA websites does not entail endorsement by ESA of the related terms and conditions or privacy policies.</p>

<h2>Cookie Notice</h2>
<p>The European Space Agency (herein the "Agency" or "ESA") is an intergovernmental organisation established by its Convention opened for signature in Paris on 30 May 1975 having its headquarters located at 24 rue du Général Bertrand, CS 30798, 75345 Paris Cedex 07, France.</p>
<p>Protection of Personal Data is of great importance for ESA, therefore this Cookie Notice aims to ensure lawfulness and transparency by explaining the cookies and similar technologies that we use on the Sentiboard website, what they do, what your choices regarding their use are and how you can contact us.</p>

<h2>Cookie Notice for Sentiboard</h2>
<p>Sentiboard presents news and information on Copernicus activities in the field of Earth Observation. The website enables visitors to learn all about the Earth Observation data, and the satellite missions and instruments that acquire this data.</p>

<h3>What is a cookie?</h3>
<p>Cookies are small bits of data that a website may send to the browser on your device, for instance mobile device or computer, upon your visit to the website. Cookies may allow a website to recognise an individual's device and store some information about the user.</p>

<h3>What are the different types of cookies?</h3>
<p>A cookie can be classified by its lifespan and the domain to which it belongs. By lifespan, a cookie is either a:</p>
<ul>
  <li><strong>session cookie</strong> which is erased when the user closes the browser; or</li>
  <li><strong>persistent cookie</strong> which remains on the user's computer/device for a pre-defined period of time.</li>
</ul>
<p>As for the domain to which it belongs, there are either:</p>
<ul>
  <li><strong>first-party cookies</strong> which are set by the web server of the visited page and share the same domain;</li>
  <li><strong>third-party cookies</strong> stored by a different domain to the visited page's domain. This can happen when the webpage references a file, such as JavaScript, located outside its domain.</li>
</ul>

<h3>Which cookies do we use?</h3>
<p><strong>Strictly Necessary or Essential Cookies:</strong> these cookies are strictly necessary for the website to provide the services that you requested and/or for the sole purpose of the transmission of the services and/or the website. Without these cookies you would not be able to access the services or the website and therefore this category cannot be disabled.</p>

<div class="callout">
  <p><strong>Note about the usage of Cookies</strong></p>
  <p>This website uses only essential session cookies to ensure its proper functioning when users are logged into their accounts.</p>
  <ul>
    <li>Temporary and deleted once you close your browser</li>
    <li>Required for secure login and maintaining your session while navigating the site</li>
    <li>Not used for tracking, analytics, or advertising</li>
    <li>Not stored, shared, or processed beyond the current session</li>
  </ul>
  <p>By using this site and logging into your account, you acknowledge the use of these essential session cookies. If you have any questions about our cookie usage, feel free to contact us.</p>
</div>

<p><strong>Analytics Cookies:</strong> ESA uses cookies generated by an open source web analytics platform called Matomo to measure the effectiveness and efficiency of Sentiboard. The cookies help ESA to know which pages are visited most often and to ensure that the Sentiboard website responds effectively to users' needs.</p>
<p>If you do not wish to receive a cookie, or if you wish your browser to notify you when you receive a cookie, you may use the option on your web browser to disable cookies or you can opt out using the 'Opt-out' option below. However, please note that if you disable all cookies you may not be able to take advantage of all the features available on this website.</p>
<p>Anonymised information generated by these cookies will be collected and processed on behalf of ESA by SERCO Italy S.p.A., and subsequently transmitted to ESA in the form of statistics reports. ESA, and SERCO Italy do not use information generated by these cookies either for promotion or marketing purposes, and they will not share the information with any third party.</p>
<p>The cookies placed on your device by the Sentiboard website are generated by an open source web analytics platform called Matomo. The cookies are used to measure the effectiveness and efficiency of Sentiboard. They are first party persistent cookies which help ESA to know which pages are visited most often and to ensure that the Sentiboard website responds effectively to users' needs. The cookies also enable ESA to monitor repeat visits. Using a random unique visitor ID, the software is able to distinguish between the first visit and subsequent visits made by the user, to improve the accuracy of the statistics.</p>

<h3>About the analytics tool used by ESA</h3>
<p>Matomo is an open source web analytics platform which complies with the EU's General Data Protection Regulation (GDPR) of 27 April 2016. This means that Matomo ensures end-user data protection, thanks to features such as source data anonymisation and opt-out mechanisms for users.</p>
<p>Cookies generated by Matomo enable ESA to track information about visitors in an anonymised form. Examples of such information are:</p>
<ul>
  <li>the user's anonymised internet protocol (IP) address. Matomo uses an IP anonymisation mechanism which automatically masks a portion of each user's IP, effectively making it impossible to identify a particular visitor from the remaining information;</li>
  <li>location: country, region (geolocation);</li>
  <li>date and time of the visit to the site;</li>
  <li>title of the page being viewed.</li>
</ul>
<p>The cookies are first party persistent cookies which also enable ESA to monitor repeat visits. Using a random unique visitor ID, the software is able to distinguish between the first visit and subsequent visits made by the user, to improve the accuracy of the reports.</p>

<h2>How to control cookies</h2>
<p>You can delete all cookies that are already on your computer and you can set most browsers to prevent them from being placed. If you do this, however, you may have to manually adjust some preferences every time you visit a site and some services and functionalities may not work. Your current status is displayed below.</p>

`;

const BODY_BOTTOM = `

<p>If your status is Opted In but you do not wish to receive cookies from the Sentiboard website, or if you wish your browser to notify you when you receive a cookie, you may use the option on your web browser to disable cookies or you can opt out using the 'Reject all cookies' option above. However, please note that if you disable all cookies you may not be able to take advantage of all of the features available on this website. Moreover, if you opt out, it will not be possible for ESA to take your use of the website into account when it improves the user experience of the Sentiboard website.</p>
<p>If you change your mind about opting out, you can choose to opt back in and be tracked again by Matomo (opt-in).</p>

<h3>Deleting old visitors logs</h3>
<p>Matomo automatically deletes visitors' logs after 12 months. The aggregated data reports are stored for an indefinite period by ESA for analysis purposes.</p>

<h3>Social Media Sharing</h3>
<p>Users logged in to Facebook/Twitter may experience some additional tracking when interacting with the social sharing buttons on our pages as clarified within the Terms and Conditions of their agreement with Facebook/Twitter, though no such information is collected/relayed/made available to ESA at any point.</p>

<h2>Contact</h2>
<p>In case of any question, you can contact ESA DPO, as first point of contact, by sending an email to: <a href="mailto:dpo@esa.int">dpo@esa.int</a>. Copy to: <a href="mailto:sentiboard@coordination-service.eu">sentiboard@coordination-service.eu</a>.</p>
`;

/** Matomo opt-in/out control. Display only in the mockup — nothing is persisted. */
function OptToggle() {
  const [optedIn, setOptedIn] = useState(true);
  return (
    <div className="cookie-toggle">
      <div className={`status${optedIn ? "" : " off"}`}>
        Your current status: <b>{optedIn ? "Opted in" : "Opted out"}</b>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={() => setOptedIn(true)}>I accept cookies</button>
        <button className="btn" onClick={() => setOptedIn(false)}>I refuse cookies</button>
      </div>
    </div>
  );
}

export default function CookieNotice() {
  return (
    <>
      <PageHeader crumb="Cookie Notice" title="Cookie Notice" />
      <section className="wrap pad">
        <Reveal className="legal">
          <div dangerouslySetInnerHTML={{ __html: BODY_TOP }} />
          <OptToggle />
          <div dangerouslySetInnerHTML={{ __html: BODY_BOTTOM }} />
        </Reveal>
      </section>
    </>
  );
}

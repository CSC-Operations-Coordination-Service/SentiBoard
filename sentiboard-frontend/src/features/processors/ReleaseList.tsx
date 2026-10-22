/* The selected mission's releases as plain HTML: what the page shows without JavaScript, in place
   of the interactive timeline (and what a crawler reads as text). Each release links to its own
   view, where the server opens the detail pane. Hidden once JavaScript runs (.sb-nojs-only). */

import x from "./explorer.module.css";
import { isoDay, laneName, type ProcessorGroup } from "./model";
import { viewHref, type ProcessorsView } from "./url-state";

export default function ReleaseList({
  groups,
  view,
}: {
  groups: ProcessorGroup[];
  view: ProcessorsView;
}) {
  const q = view.q.trim().toLowerCase();
  const shown = groups
    .map((g) => {
      const groupHit = !q || `${g.label} ${g.sub}`.toLowerCase().includes(q);
      const releases = g.releases.filter(
        (r) =>
          (view.baseline === "all" || r.isCurrent) &&
          (groupHit || r.baseline.toLowerCase().includes(q)),
      );
      return { g, releases };
    })
    .filter(({ releases }) => releases.length > 0);

  return (
    <ul className={`${x.list} sb-nojs-only`} aria-label="Processor releases">
      {shown.map(({ g, releases }) => (
        <li key={g.ipf}>
          <h3 className={x.listProc}>
            {laneName(g.label)}
            {g.sub && <span>{g.sub}</span>}
          </h3>
          <ol className={x.listReleases} reversed>
            {/* newest first */}
            {[...releases].reverse().map((r) => (
              <li key={r.id}>
                <a
                  href={viewHref({ ...view, release: r.id })}
                  aria-current={view.release === r.id ? "true" : undefined}
                >
                  <span>{r.baseline}</span>
                  <span>Operational since {isoDay(r.ms)}</span>
                  <span className={r.isCurrent ? x.listNow : undefined}>
                    {r.isCurrent ? "Current baseline" : "Superseded"}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}

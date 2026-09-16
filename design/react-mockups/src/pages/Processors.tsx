import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { PROCESSORS_DESCRIPTION } from "@/data/copy";
import { PROCESSOR_GROUPS, MISSION_ORDER, MISSION_NAMES, MissionId } from "@/data/processor-releases";
import CustomSelect, { type SelectOption } from "./CustomSelect";
import s from "./processors.module.css";

// Map mission IDs to satellite image paths
const SATELLITE_IMAGES: Record<MissionId, string> = {
  "1": "/assets/img/satellites/s1.jpg",
  "2": "/assets/img/satellites/s2.jpg",
  "3": "/assets/img/satellites/s3.jpg",
  "5P": "/assets/img/satellites/s5.jpg",
};

export default function Processors() {
  const [activeMission, setActiveMission] = useState<MissionId>("1");
  const [expandedProc, setExpandedProc] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});

  const satelliteImageUrl = SATELLITE_IMAGES[activeMission];

  return (
    <>
      <PageHeader crumb="Processors" title="Processors"
        desc={PROCESSORS_DESCRIPTION}
        img="/assets/img/modules/processors.jpg"
      />

      <section className={s.container}>
        {/* Satellite selector tabs - all four buttons always visible */}
        <div className={s.satTabs}>
          {MISSION_ORDER.map((m) => (
            <button
              key={m}
              className={`${s.tabBtn} ${activeMission === m ? s.active : ""}`}
              onClick={() => setActiveMission(m)}
            >
              S{m}
            </button>
          ))}
        </div>

        {/* Split layout */}
        <div className={s.split}>
          {/* Left pane: Satellite visualization */}
          <section className={s.satpane}>
            <div className={s.artGlow} aria-hidden="true"></div>
            <div className={s.art} aria-hidden="true"></div>

            {/* Satellite image */}
            {satelliteImageUrl && (
              <img
                src={satelliteImageUrl}
                alt={`Sentinel-${activeMission} satellite`}
                className={s.satelliteImage}
              />
            )}

            <div className={s.placeholder}>
              <div className={s.placeholderText}>Sentinel-{activeMission} Visualization</div>
            </div>
          </section>

          {/* Right pane: Processors list */}
          <section className={s.procpane}>
            <div className={s.phead}>
              <h2>Processors - Sentinel-{activeMission}</h2>
            </div>

            <div className={s.plist}>
              {PROCESSOR_GROUPS.filter((g) => g.mission === activeMission).map((group) => {
                const isExpanded = expandedProc === group.ipf;
                const currentRelease = group.releases[group.releases.length - 1];
                const selectedVersionValue = selectedVersion[group.ipf] ?? currentRelease?.baseline;
                const selectedReleaseIdx = group.releases.findIndex((r) => r.baseline === selectedVersionValue);
                const selectedRelease = group.releases[selectedReleaseIdx] || currentRelease;
                const isCurrentVersion = selectedRelease === currentRelease;

                return group.releases.length > 0 ? (
                  <div
                    key={group.ipf}
                    className={`${s.prow} ${isExpanded ? s.on : ""}`}
                  >
                    <button
                      className={s.phdr}
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedProc(isExpanded ? null : group.ipf)}
                    >
                      <span className={s.nm}>
                        <b>{group.label}</b>
                        <span>{group.sub}</span>
                      </span>
                      <span className={s.cur}>
                        <b>{currentRelease.baseline}</b>
                        <span>
                          <i></i>in force · {currentRelease.from.toUpperCase()}
                        </span>
                      </span>
                      <svg
                        className={s.chev}
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6"></path>
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className={s.panel}>
                        <div className={s.in}>
                          {/* Version selector with prev/next buttons */}
                          <div className={s.vsel}>
                            <label htmlFor={`v-${group.ipf}`}>Baseline version</label>
                            <button
                              className={`${s.step} ${s.prev}`}
                              disabled={selectedReleaseIdx <= 0}
                              onClick={() => {
                                if (selectedReleaseIdx > 0) {
                                  setSelectedVersion({
                                    ...selectedVersion,
                                    [group.ipf]: group.releases[selectedReleaseIdx - 1].baseline,
                                  });
                                }
                              }}
                              aria-label="Previous version"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M15 5l-7 7 7 7"></path>
                              </svg>
                            </button>
                            <CustomSelect
                              id={`v-${group.ipf}`}
                              value={selectedVersionValue}
                              options={group.releases.map((r, idx) => ({
                                value: r.baseline,
                                label: `${r.baseline} · ${r.from}${idx === group.releases.length - 1 ? " · in force" : ""}`,
                                isCurrent: idx === group.releases.length - 1,
                              }))}
                              onChange={(value) => setSelectedVersion({ ...selectedVersion, [group.ipf]: value })}
                            />
                            <button
                              className={`${s.step} ${s.next}`}
                              disabled={selectedReleaseIdx >= group.releases.length - 1}
                              onClick={() => {
                                if (selectedReleaseIdx < group.releases.length - 1) {
                                  setSelectedVersion({
                                    ...selectedVersion,
                                    [group.ipf]: group.releases[selectedReleaseIdx + 1].baseline,
                                  });
                                }
                              }}
                              aria-label="Next version"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M9 5l7 7-7 7"></path>
                              </svg>
                            </button>
                            {isCurrentVersion && <span className={`${s.vtag} ${s.now}`}>In force</span>}
                          </div>

                          {/* Metadata */}
                          <dl className={s.meta}>
                            <div>
                              <dt>Processor Baseline ID:</dt>
                              <dd>{selectedRelease.baseline}</dd>
                            </div>
                            <div>
                              <dt>Operational since:</dt>
                              <dd>{selectedRelease.day}</dd>
                            </div>
                            <div>
                              <dt>Impacted satellite(s):</dt>
                              <dd>{selectedRelease.sats.join(", ")}</dd>
                            </div>
                          </dl>

                          {/* Release notes */}
                          {selectedRelease.notes && (
                            <div className={s.rn}>
                              <h4>Release notes</h4>
                              <p>{selectedRelease.notes}</p>
                              {selectedRelease.sats.length > 0 && (
                                <div className={s.sats}>
                                  {selectedRelease.sats.map((sat) => (
                                    <span key={sat}>{sat}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null;
              })}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}

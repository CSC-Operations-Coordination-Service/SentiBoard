'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Search, BarChart3, Clock, X, List } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { PROCESSORS_LOG_DESCRIPTION } from '@/data/copy';
import { PROCESSOR_GROUPS, MISSION_ORDER, MISSION_NAMES, MissionId, RELEASE_FEED } from '@/data/processor-releases';
import type { ProcessorGroup, ReleaseRecord } from '@/data/processor-releases';
import s from './processors-interactive.module.css';

type ViewMode = 'timeline' | 'table' | 'gantt';
type MissionFilter = 'ALL' | MissionId;

interface ProcessorSelection {
  ipf: string;
  baselineIdx: number;
}

export default function ProcessorsInteractive() {
  const [view, setView] = useState<ViewMode>('table');
  const [missionFilter, setMissionFilter] = useState<MissionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('2022-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [selectedProcessor, setSelectedProcessor] = useState<ProcessorSelection | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredProcessors = useMemo(() => {
    return PROCESSOR_GROUPS.filter((g) => {
      if (missionFilter !== 'ALL' && g.mission !== missionFilter) return false;
      if (searchQuery && !g.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [missionFilter, searchQuery]);

  const filteredReleases = useMemo(() => {
    const fromMs = new Date(dateFrom).getTime();
    const toMs = new Date(dateTo).getTime();
    return RELEASE_FEED.filter((r) => {
      if (missionFilter !== 'ALL' && r.mission !== missionFilter) return false;
      if (r.ms < fromMs || r.ms > toMs) return false;
      return true;
    });
  }, [missionFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const allReleases = PROCESSOR_GROUPS.flatMap((g) => g.releases);
    const dateRange = allReleases.length > 0 ? {
      from: new Date(Math.min(...allReleases.map((r) => r.ms))),
      to: new Date(Math.max(...allReleases.map((r) => r.ms))),
    } : null;

    return {
      totalReleases: filteredReleases.length,
      activeProcessors: filteredProcessors.filter((p) => p.releases.length > 0).length,
      releaseNotesAvailable: filteredReleases.filter((r) => r.notes).length,
      dateSpan: dateRange,
    };
  }, [filteredReleases, filteredProcessors]);

  const timeRange = useMemo(() => {
    if (filteredReleases.length === 0) {
      return { min: new Date(dateFrom).getTime(), max: new Date(dateTo).getTime() };
    }
    const times = filteredReleases.map((r) => r.ms);
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [filteredReleases, dateFrom, dateTo]);

  const toggleExpandedGroup = (ipf: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(ipf)) {
      newSet.delete(ipf);
    } else {
      newSet.add(ipf);
    }
    setExpandedGroups(newSet);
  };

  const toggleExpandedRow = (key: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedRows(newSet);
  };

  return (
    <div className={s.root}>
      <PageHeader
        crumb="Processors"
        title="Processors"
        desc={PROCESSORS_LOG_DESCRIPTION}
        img="/assets/img/modules/processors.jpg"
      />

      <section className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Total Releases</div>
          <div className={s.kpiValue}>{stats.totalReleases}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Active Processors</div>
          <div className={s.kpiValue}>{stats.activeProcessors}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Release Notes</div>
          <div className={s.kpiValue}>{stats.releaseNotesAvailable}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Date Span</div>
          <div className={s.kpiDate}>
            {stats.dateSpan ? (
              <>
                {stats.dateSpan.from.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} →<br />
                {stats.dateSpan.to.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>
      </section>

      <div className={s.filterBar}>
        <div className={s.missionTabs}>
          <button
            onClick={() => setMissionFilter('ALL')}
            className={`${s.tab} ${missionFilter === 'ALL' ? s.active : ''}`}
          >
            ALL
          </button>
          {MISSION_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMissionFilter(m)}
              className={`${s.tab} ${missionFilter === m ? s.active : ''}`}
            >
              S{m}
            </button>
          ))}
        </div>

        <div className={s.searchContainer}>
          <Search size={16} style={{ color: 'var(--text-mute)', marginRight: '8px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search processors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={s.searchInput}
          />
        </div>

        <div className={s.dateInputs}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={s.dateInput}
          />
          <span style={{ color: 'var(--text-mute)' }}>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={s.dateInput}
          />
        </div>

        <div className={s.viewToggle}>
          <button
            onClick={() => setView('timeline')}
            className={`${s.viewBtn} ${view === 'timeline' ? s.active : ''}`}
            title="Timeline Feed"
          >
            <Clock size={14} style={{ marginRight: '6px' }} />
            TIMELINE
          </button>
          <button
            onClick={() => setView('table')}
            className={`${s.viewBtn} ${view === 'table' ? s.active : ''}`}
            title="Data Table"
          >
            <List size={14} style={{ marginRight: '6px' }} />
            TABLE
          </button>
          <button
            onClick={() => setView('gantt')}
            className={`${s.viewBtn} ${view === 'gantt' ? s.active : ''}`}
            title="Gantt Chart"
          >
            <BarChart3 size={14} style={{ marginRight: '6px' }} />
            GANTT
          </button>
        </div>
      </div>

      <div className={s.mainContainer}>
        {view === 'timeline' && (
          <TimelineView
            releases={filteredReleases}
            timeRange={timeRange}
            selectedProcessor={selectedProcessor}
            onSelectProcessor={setSelectedProcessor}
          />
        )}
        {view === 'table' && (
          <TableView
            processors={filteredProcessors}
            selectedProcessor={selectedProcessor}
            onSelectProcessor={setSelectedProcessor}
            expandedRows={expandedRows}
            onToggleExpandedRow={toggleExpandedRow}
          />
        )}
        {view === 'gantt' && (
          <GanttView
            processors={filteredProcessors}
            timeRange={timeRange}
            selectedProcessor={selectedProcessor}
            onSelectProcessor={setSelectedProcessor}
            expandedGroups={expandedGroups}
            onToggleExpandedGroup={toggleExpandedGroup}
          />
        )}

        {selectedProcessor && (
          <div className={s.detailPanel}>
            <div className={s.detailHeader}>
              <h3 className={s.detailTitle}>Release Details</h3>
              <button
                onClick={() => setSelectedProcessor(null)}
                className={s.closeBtn}
                aria-label="Close detail panel"
              >
                <X size={18} />
              </button>
            </div>

            <ProcessorDetailPanel
              processors={filteredProcessors}
              selection={selectedProcessor}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineView({
  releases,
  timeRange,
  selectedProcessor,
  onSelectProcessor,
}: {
  releases: ReleaseRecord[];
  timeRange: { min: number; max: number };
  selectedProcessor: ProcessorSelection | null;
  onSelectProcessor: (sel: ProcessorSelection) => void;
}) {
  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className={s.timelineView}>
      {releases.map((release, idx) => {
        const isSelected =
          selectedProcessor?.ipf === release.ipf &&
          selectedProcessor?.baselineIdx === PROCESSOR_GROUPS.find((g) => g.ipf === release.ipf)?.releases.indexOf(
            PROCESSOR_GROUPS.find((g) => g.ipf === release.ipf)?.releases.find((r) => r.baseline === release.baseline)!
          );

        return (
          <div key={`${release.ipf}-${release.baseline}-${idx}`} className={s.timelineItem}>
            <div className={`${s.timelineNode} ${isSelected ? s.selected : ''}`} />

            <div
              onClick={() =>
                onSelectProcessor({
                  ipf: release.ipf,
                  baselineIdx: PROCESSOR_GROUPS.find((g) => g.ipf === release.ipf)?.releases.indexOf(
                    PROCESSOR_GROUPS.find((g) => g.ipf === release.ipf)?.releases.find(
                      (r) => r.baseline === release.baseline
                    )!
                  ) || 0,
                })
              }
              className={s.timelineCard}
            >
              <div className={s.timelineCardHeader}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{release.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-mute)' }}>{release.proc}</div>
                </div>
                <span className={s.baselineTag}>{release.baseline}</span>
              </div>

              <div className={s.timelineCardDate}>
                <Calendar size={12} style={{ marginRight: '6px' }} />
                {formatDate(release.ms)}
              </div>

              {release.notes && (
                <p className={s.timelineCardNotes}>{release.notes}</p>
              )}

              <div className={s.satTags}>
                {release.sats.map((sat) => (
                  <span key={sat} className={s.satTag}>{sat}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {releases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-mute)' }}>
          No releases match your filters.
        </div>
      )}
    </div>
  );
}

function TableView({
  processors,
  selectedProcessor,
  onSelectProcessor,
  expandedRows,
  onToggleExpandedRow,
}: {
  processors: ProcessorGroup[];
  selectedProcessor: ProcessorSelection | null;
  onSelectProcessor: (sel: ProcessorSelection) => void;
  expandedRows: Set<string>;
  onToggleExpandedRow: (key: string) => void;
}) {
  return (
    <div className={s.tableView}>
      <div className={s.tableHeader}>
        <div className={s.tableColIcon}></div>
        <div className={s.tableColProcessor}>Processor</div>
        <div className={s.tableColBaseline}>Baseline</div>
        <div className={s.tableColDate}>Released</div>
        <div className={s.tableColNotes}>Status</div>
      </div>

      {processors.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-mute)' }}>
          No processors match your filters.
        </div>
      )}

      {processors.map((group) => {
        const isGroupExpanded = expandedRows.has(group.ipf);
        const currentRelease = group.releases[group.releases.length - 1];

        return (
          <div key={group.ipf} className={s.tableGroup}>
            <button
              onClick={() => onToggleExpandedRow(group.ipf)}
              className={s.tableGroupRow}
            >
              <div className={s.tableColIcon}>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--text-mute)',
                    transform: isGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>
              <div className={s.tableColProcessor}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{group.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-mute)' }}>{group.sub}</div>
              </div>
              <div className={s.tableColBaseline}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  {currentRelease?.baseline || '—'}
                </span>
              </div>
              <div className={s.tableColDate}>
                {currentRelease?.from || '—'}
              </div>
              <div className={s.tableColNotes}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '10px',
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  color: 'var(--accent)',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontFamily: 'var(--font-mono)',
                }}>
                  IN FORCE
                </span>
              </div>
            </button>

            {isGroupExpanded && (
              <div className={s.tableGroupExpanded}>
                {group.releases.map((release, idx) => {
                  const isSelected = selectedProcessor?.ipf === group.ipf && selectedProcessor?.baselineIdx === idx;
                  const rowKey = `${group.ipf}-${release.baseline}`;

                  return (
                    <div key={rowKey} className={s.tableDataRow}>
                      <button
                        onClick={() => onToggleExpandedRow(rowKey)}
                        className={s.tableDataRowHeader}
                        style={{
                          backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                        }}
                      >
                        <div className={s.tableColIcon}>
                          <ChevronDown
                            size={14}
                            style={{
                              color: 'var(--text-mute)',
                              transform: expandedRows.has(rowKey) ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              marginLeft: '16px',
                            }}
                          />
                        </div>
                        <div className={s.tableColProcessor}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                            {release.baseline}
                          </span>
                        </div>
                        <div className={s.tableColBaseline}>
                          <span style={{ fontSize: '11px', color: 'var(--text-mute)' }}>
                            {release.day}
                          </span>
                        </div>
                        <div className={s.tableColDate}>
                          <span style={{ fontSize: '11px' }}>{release.from}</span>
                        </div>
                        <div className={s.tableColNotes}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProcessor({ ipf: group.ipf, baselineIdx: idx });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--accent)',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              textDecoration: 'underline',
                            }}
                          >
                            View
                          </button>
                        </div>
                      </button>

                      {expandedRows.has(rowKey) && release.notes && (
                        <div className={s.tableDataRowNotes}>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                            {release.notes}
                          </div>
                          <div className={s.satTags} style={{ marginTop: '12px' }}>
                            {release.sats.map((sat) => (
                              <span key={sat} className={s.satTag}>{sat}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GanttView({
  processors,
  timeRange,
  selectedProcessor,
  onSelectProcessor,
  expandedGroups,
  onToggleExpandedGroup,
}: {
  processors: ProcessorGroup[];
  timeRange: { min: number; max: number };
  selectedProcessor: ProcessorSelection | null;
  onSelectProcessor: (sel: ProcessorSelection) => void;
  expandedGroups: Set<string>;
  onToggleExpandedGroup: (ipf: string) => void;
}) {
  const getTimelinePosition = (ms: number) => {
    if (timeRange.min === timeRange.max) return 50;
    return ((ms - timeRange.min) / (timeRange.max - timeRange.min)) * 100;
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  return (
    <div className={s.ganttView}>
      <div className={s.ganttHeader}>
        <div className={s.ganttLabelCol}>Processor</div>
        <div className={s.ganttTimelineCol}>
          <div className={s.ganttAxisLabels}>
            <span>{formatDate(timeRange.min)}</span>
            <span>{formatDate(timeRange.max)}</span>
          </div>
        </div>
      </div>

      {processors.map((group) => {
        const isExpanded = expandedGroups.has(group.ipf);

        return (
          <div key={group.ipf} className={s.ganttGroup}>
            <button
              onClick={() => onToggleExpandedGroup(group.ipf)}
              className={s.ganttGroupHeader}
            >
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-mute)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                }}
              />
              <div className={s.groupInfo}>
                <div className={s.groupLabel}>{group.label}</div>
                <div className={s.groupSub}>{group.sub}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent)' }}>
                {group.releases.length} releases
              </div>
            </button>

            {isExpanded && (
              <div className={s.ganttExpanded}>
                {group.releases.map((release, idx) => {
                  const pos = getTimelinePosition(release.ms);
                  const isSelected = selectedProcessor?.ipf === group.ipf && selectedProcessor?.baselineIdx === idx;

                  return (
                    <div key={`${release.baseline}-${idx}`} className={s.ganttRow}>
                      <div className={s.ganttLabel}>{release.baseline}</div>
                      <div
                        className={s.ganttBar}
                        onClick={() => onSelectProcessor({ ipf: group.ipf, baselineIdx: idx })}
                        style={{
                          backgroundPosition: `${pos}% 50%`,
                        }}
                      >
                        <div
                          className={`${s.ganttDot} ${isSelected ? s.selected : ''}`}
                          style={{ left: `${Math.max(1, Math.min(99, pos - 1))}%` }}
                        />
                      </div>
                      <div className={s.ganttDate}>{release.from}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {processors.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-mute)' }}>
          No processors match your filters.
        </div>
      )}
    </div>
  );
}

function ProcessorDetailPanel({
  processors,
  selection,
}: {
  processors: ProcessorGroup[];
  selection: ProcessorSelection;
}) {
  const processor = processors.find((p) => p.ipf === selection.ipf);
  if (!processor) return null;

  const release = processor.releases[selection.baselineIdx];
  if (!release) return null;

  const prevRelease = processor.releases[selection.baselineIdx - 1];
  const nextRelease = processor.releases[selection.baselineIdx + 1];
  const isLatest = selection.baselineIdx === processor.releases.length - 1;

  return (
    <div className={s.detailContent}>
      <div className={s.detailSection}>
        <h4 className={s.detailSectionLabel}>Processor</h4>
        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
          {processor.label}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-mute)' }}>{processor.sub}</div>
      </div>

      <div className={s.detailDivider} />

      <div className={s.detailSection}>
        <h4 className={s.detailSectionLabel}>Baseline</h4>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            {release.baseline}
          </span>
          {isLatest && (
            <span style={{
              fontSize: '10px',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              color: 'var(--accent)',
              padding: '4px 10px',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
            }}>
              IN FORCE
            </span>
          )}
        </div>
      </div>

      <div className={s.detailDivider} />

      <div className={s.detailSection}>
        <h4 className={s.detailSectionLabel}>Operational</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>
          {release.day}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-mute)' }}>{release.from}</div>
      </div>

      {prevRelease && (
        <>
          <div className={s.detailDivider} />
          <div className={s.detailSection}>
            <h4 className={s.detailSectionLabel}>Baseline Transition</h4>
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-mute)' }}>Previous:</span>
                <span style={{ marginLeft: '8px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  {prevRelease.baseline}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-mute)' }}>Current:</span>
                <span style={{ marginLeft: '8px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  {release.baseline}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {release.sats.length > 0 && (
        <>
          <div className={s.detailDivider} />
          <div className={s.detailSection}>
            <h4 className={s.detailSectionLabel}>Satellites</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {release.sats.map((sat) => (
                <span key={sat} className={s.satTag}>{sat}</span>
              ))}
            </div>
          </div>
        </>
      )}

      {release.notes && (
        <>
          <div className={s.detailDivider} />
          <div className={s.detailSection}>
            <h4 className={s.detailSectionLabel}>Release Notes</h4>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-dim)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {release.notes}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

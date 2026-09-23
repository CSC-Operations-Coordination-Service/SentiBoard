'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Calendar, Search, BarChart3, Clock, X, List, ArrowRight, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { PROCESSORS_LOG_DESCRIPTION } from '@/data/copy';
import { PROCESSOR_GROUPS, MISSION_ORDER, MISSION_NAMES, MissionId, RELEASE_FEED } from '@/data/processor-releases';
import type { ProcessorGroup, ReleaseRecord } from '@/data/processor-releases';
import s from './processors-interactive.module.css';

type ViewMode = 'stream' | 'cards' | 'timeline' | 'table' | 'gantt';
type MissionFilter = 'ALL' | MissionId;

interface ProcessorSelection {
  ipf: string;
  baselineIdx: number;
}

export default function ProcessorsInteractive() {
  const [view, setView] = useState<ViewMode>('stream');
  const [timelinePosition, setTimelinePosition] = useState(0.5);
  const [missionFilter, setMissionFilter] = useState<MissionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('2022-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [selectedProcessor, setSelectedProcessor] = useState<ProcessorSelection | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProcessor(null);
      }
    };
    if (selectedProcessor) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [selectedProcessor]);

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
        img="/assets/img/modules/processor_2.jpg"
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
            onClick={() => setView('stream')}
            className={`${s.viewBtn} ${view === 'stream' ? s.active : ''}`}
            title="Interactive Timeline Stream"
          >
            <Zap size={14} style={{ marginRight: '6px' }} />
            STREAM
          </button>
          <button
            onClick={() => setView('cards')}
            className={`${s.viewBtn} ${view === 'cards' ? s.active : ''}`}
            title="Cards Grid"
          >
            <BarChart3 size={14} style={{ marginRight: '6px' }} />
            CARDS
          </button>
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

      {view === 'stream' && (
        <div className={s.timeSliderSection}>
          <div className={s.presetButtons}>
            <button
              onClick={() => {
                setDateFrom('2020-01-01');
                setDateTo('2026-12-31');
              }}
              className={s.presetBtn}
            >
              All Time
            </button>
            <button
              onClick={() => {
                const year = new Date().getFullYear();
                setDateFrom(`${year}-01-01`);
                setDateTo(`${year}-12-31`);
              }}
              className={s.presetBtn}
            >
              {new Date().getFullYear()}
            </button>
            <button
              onClick={() => {
                setDateFrom('2025-01-01');
                setDateTo('2025-12-31');
              }}
              className={s.presetBtn}
            >
              2025
            </button>
            <button
              onClick={() => {
                setDateFrom('2024-01-01');
                setDateTo('2024-12-31');
              }}
              className={s.presetBtn}
            >
              2024
            </button>
            <button
              onClick={() => {
                const releases = RELEASE_FEED.sort((a, b) => b.ms - a.ms).slice(0, 20);
                if (releases.length > 0) {
                  const latestMs = releases[0].ms;
                  const earliestMs = releases[releases.length - 1].ms;
                  setDateFrom(new Date(earliestMs).toISOString().split('T')[0]);
                  setDateTo(new Date(latestMs).toISOString().split('T')[0]);
                }
              }}
              className={s.presetBtn}
            >
              Latest Releases
            </button>
          </div>

          <div className={s.timeSlider}>
            <span className={s.timeSliderLabel}>{dateFrom}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={timelinePosition * 100}
              onChange={(e) => {
                const pos = parseFloat(e.target.value) / 100;
                setTimelinePosition(pos);
                const allReleases = RELEASE_FEED.sort((a, b) => a.ms - b.ms);
                if (allReleases.length > 0) {
                  const minMs = allReleases[0].ms;
                  const maxMs = allReleases[allReleases.length - 1].ms;
                  const targetMs = minMs + (maxMs - minMs) * pos;
                  const windowMs = 7776000000;
                  const start = Math.max(minMs, targetMs - windowMs / 2);
                  const end = Math.min(maxMs, start + windowMs);
                  setDateFrom(new Date(start).toISOString().split('T')[0]);
                  setDateTo(new Date(end).toISOString().split('T')[0]);
                }
              }}
              className={s.timeSliderInput}
            />
            <span className={s.timeSliderLabel}>{dateTo}</span>
          </div>
        </div>
      )}

      <div className={s.mainContainer}>
        {view === 'stream' && (
          <TimelineStreamView
            releases={filteredReleases}
            processors={filteredProcessors}
            timeRange={timeRange}
            selectedProcessor={selectedProcessor}
            onSelectProcessor={setSelectedProcessor}
          />
        )}
        {view === 'cards' && (
          <CardsView
            processors={filteredProcessors}
            selectedProcessor={selectedProcessor}
            onSelectProcessor={setSelectedProcessor}
          />
        )}
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
          />
        )}

        {selectedProcessor && (
          <>
            <div
              className={s.modalBackdrop}
              onClick={() => setSelectedProcessor(null)}
              aria-label="Close modal"
            />
            <div className={s.modalContainer}>
              <div className={s.modalContent}>
                <div className={s.modalHeader}>
                  <div className={s.modalTitleSection}>
                    <h2 className={s.modalTitle}>Release Details</h2>
                  </div>
                  <button
                    onClick={() => setSelectedProcessor(null)}
                    className={s.modalCloseBtn}
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>

                <ProcessorDetailPanel
                  processors={filteredProcessors}
                  selection={selectedProcessor}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimelineStreamView({
  releases,
  processors,
  timeRange,
  selectedProcessor,
  onSelectProcessor,
}: {
  releases: ReleaseRecord[];
  processors: ProcessorGroup[];
  timeRange: { min: number; max: number };
  selectedProcessor: ProcessorSelection | null;
  onSelectProcessor: (sel: ProcessorSelection) => void;
}) {
  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  return (
    <div className={s.streamView}>
      {releases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-mute)' }}>
          No releases match your filters.
        </div>
      )}

      <div className={s.streamTimeline}>
        <div className={s.streamAxis} />
        {releases.map((release, idx) => {
          const processor = processors.find((p) => p.ipf === release.ipf);
          const isSelected =
            selectedProcessor?.ipf === release.ipf &&
            processor?.releases.some((r) => r.baseline === release.baseline);

          return (
            <div
              key={`${release.ipf}-${release.baseline}-${idx}`}
              className={`${s.streamNode} ${isSelected ? s.selected : ''}`}
            >
              <div className={s.streamNodeContent}>
                <div
                  className={s.streamCard}
                  onClick={() => {
                    const baselineIdx = processor?.releases.findIndex((r) => r.baseline === release.baseline) || 0;
                    onSelectProcessor({ ipf: release.ipf, baselineIdx });
                  }}
                >
                  <div className={s.streamCardHeader}>
                    <div>{release.label}</div>
                    <span className={s.streamBaselineTag}>{release.baseline}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-mute)', marginTop: '2px', textAlign: 'center' }}>
                    {formatDate(release.ms)}
                  </div>
                  <div className={s.streamSatTags}>
                    {release.sats.slice(0, 2).map((sat) => (
                      <span key={sat} className={s.streamSatTag}>{sat}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardsView({
  processors,
  selectedProcessor,
  onSelectProcessor,
}: {
  processors: ProcessorGroup[];
  selectedProcessor: ProcessorSelection | null;
  onSelectProcessor: (sel: ProcessorSelection) => void;
}) {
  const getStatusColor = (idx: number) => {
    const colors = [
      { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
      { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
      { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
      { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className={s.cardsView}>
      {processors.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-mute)' }}>
          No processors match your filters.
        </div>
      )}

      <div className={s.cardsGrid}>
        {processors.map((group, idx) => {
          const currentRelease = group.releases[group.releases.length - 1];
          const statusColor = getStatusColor(idx);
          const isSelected = selectedProcessor?.ipf === group.ipf;

          return (
            <div
              key={group.ipf}
              className={`${s.processorCard} ${isSelected ? s.selected : ''}`}
              onClick={() => onSelectProcessor({ ipf: group.ipf, baselineIdx: group.releases.length - 1 })}
            >
              <div className={s.cardHeader}>
                <div className={s.cardTitle}>
                  <div className={s.cardName}>{group.label}</div>
                  <div className={s.cardSub}>{group.sub}</div>
                </div>
                <div
                  className={s.statusBadge}
                  style={{
                    backgroundColor: statusColor.bg,
                    color: statusColor.text,
                    borderColor: statusColor.border,
                  }}
                >
                  IN FORCE
                </div>
              </div>

              <div className={s.cardMetadata}>
                <div className={s.metaItem}>
                  <div className={s.metaLabel}>Latest Baseline</div>
                  <div className={s.metaValue} style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {currentRelease?.baseline || '—'}
                  </div>
                </div>
                <div className={s.metaItem}>
                  <div className={s.metaLabel}>Release Date</div>
                  <div className={s.metaValue}>{currentRelease?.from || '—'}</div>
                </div>
              </div>

              {currentRelease?.sats.length > 0 && (
                <div className={s.cardSatellites}>
                  <div className={s.metaLabel} style={{ marginBottom: '8px' }}>Satellites</div>
                  <div className={s.satTags}>
                    {currentRelease.sats.map((sat) => (
                      <span key={sat} className={s.satTag}>{sat}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectProcessor({ ipf: group.ipf, baselineIdx: group.releases.length - 1 });
                }}
                className={s.cardCta}
              >
                View Release Notes
                <ArrowRight size={14} style={{ marginLeft: '6px' }} />
              </button>
            </div>
          );
        })}
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

  const getYears = () => {
    const years = new Set<number>();
    releases.forEach((r) => {
      years.add(new Date(r.ms).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const filteredByYear = yearFilter
    ? releases.filter((r) => new Date(r.ms).getFullYear() === yearFilter)
    : releases;

  const years = getYears();

  return (
    <div className={s.timelineView}>
      {years.length > 0 && (
        <div className={s.timelineYearFilter}>
          <button
            onClick={() => setYearFilter(null)}
            className={`${s.yearFilterBtn} ${yearFilter === null ? s.active : ''}`}
          >
            All Years
          </button>
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setYearFilter(year)}
              className={`${s.yearFilterBtn} ${yearFilter === year ? s.active : ''}`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {filteredByYear.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-mute)' }}>
          No releases match your filters.
        </div>
      )}

      {filteredByYear.map((release, idx) => {
        const isSelected =
          selectedProcessor?.ipf === release.ipf &&
          selectedProcessor?.baselineIdx === PROCESSOR_GROUPS.find((g) => g.ipf === release.ipf)?.releases.indexOf(
            PROCESSOR_GROUPS.find((g) => g.ipf === release.ipf)?.releases.find((r) => r.baseline === release.baseline)!
          );

        const truncatedNotes = release.notes ? release.notes.substring(0, 80).trim() + (release.notes.length > 80 ? '...' : '') : 'No notes';

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
                <div className={s.timelineCardMeta}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{release.label}</div>
                  <span className={s.baselineTag}>{release.baseline}</span>
                </div>
              </div>

              <div className={s.timelineCardDate}>
                <Calendar size={12} style={{ marginRight: '6px' }} />
                {formatDate(release.ms)}
              </div>

              <p className={s.timelineCardNotes}>{truncatedNotes}</p>
            </div>
          </div>
        );
      })}
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
}: {
  processors: ProcessorGroup[];
  timeRange: { min: number; max: number };
  selectedProcessor: ProcessorSelection | null;
  onSelectProcessor: (sel: ProcessorSelection) => void;
}) {
  const getTimelinePosition = (ms: number) => {
    if (timeRange.min === timeRange.max) return 50;
    return ((ms - timeRange.min) / (timeRange.max - timeRange.min)) * 100;
  };

  const getYearHeaders = () => {
    const years: number[] = [];
    const startYear = new Date(timeRange.min).getFullYear();
    const endYear = new Date(timeRange.max).getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  };

  const getYearPosition = (year: number) => {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    const startPos = getTimelinePosition(yearStart);
    const endPos = getTimelinePosition(yearEnd);
    return { startPos, endPos, width: endPos - startPos };
  };

  return (
    <div className={s.ganttView}>
      <div className={s.ganttHeader}>
        <div className={s.ganttLabelCol}>Processor</div>
        <div className={s.ganttTimelineCol}>
          <div className={s.ganttYearHeaders}>
            {getYearHeaders().map((year) => {
              const { startPos, width } = getYearPosition(year);
              return (
                <div
                  key={year}
                  className={s.ganttYearHeader}
                  style={{ left: `${startPos}%`, width: `${width}%` }}
                >
                  {year}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {processors.map((group) => (
        <div key={group.ipf} className={s.ganttGroup}>
          <div className={s.ganttGroupLabel}>
            <div className={s.groupInfo}>
              <div className={s.groupLabel}>{group.label}</div>
              <div className={s.groupSub}>{group.sub}</div>
            </div>
          </div>

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
        </div>
      ))}

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
      <div className={s.modalSummarySection}>
        <div className={s.summaryHeader}>
          <div>
            <div className={s.summaryProcessorName}>{processor.label}</div>
            <div className={s.summaryProcessorSub}>{processor.sub}</div>
          </div>
          {isLatest && (
            <div style={{
              fontSize: '10px',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              color: 'var(--accent)',
              padding: '6px 12px',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              letterSpacing: '0.05em',
            }}>
              IN FORCE
            </div>
          )}
        </div>

        <div className={s.summaryGrid}>
          <div className={s.summaryItem}>
            <div className={s.summaryLabel}>Baseline</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
              {release.baseline}
            </div>
          </div>
          <div className={s.summaryItem}>
            <div className={s.summaryLabel}>Operational Since</div>
            <div style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              {release.from}
            </div>
          </div>
          <div className={s.summaryItem}>
            <div className={s.summaryLabel}>Release Day</div>
            <div style={{ fontSize: '13px', color: 'var(--text)' }}>
              {release.day}
            </div>
          </div>
        </div>
      </div>

      <div className={s.detailDivider} />

      <div className={s.detailSection}>
        <h4 className={s.detailSectionLabel}>Release History</h4>
        {prevRelease && (
          <>
            <div className={s.detailDivider} />
            <div style={{ marginBottom: '12px' }}>
              <h5 className={s.detailSectionLabel}>Baseline Transition</h5>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '0' }}>
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
            <div style={{ marginBottom: '12px' }}>
              <h5 className={s.detailSectionLabel}>Satellites</h5>
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
          </>
        )}
      </div>
    </div>
  );
}

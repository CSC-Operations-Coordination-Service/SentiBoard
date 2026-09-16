'use client';

import { useState } from 'react';

const DATATAKES = [
  { id:'S1C-76395', sat:'Sentinel-1C', day:'2026-09-10', acqPct:0.00, acq:'PLANNED' },
  { id:'S2A-48201-1', sat:'Sentinel-2A', day:'2026-07-16', acqPct:100.00, acq:'PUBLISHED' },
  { id:'S1C-19044-3', sat:'Sentinel-1C', day:'2026-09-09', acqPct:98.20, acq:'PUBLISHED' },
  { id:'S3B-07711-2', sat:'Sentinel-3B', day:'2026-09-09', acqPct:76.40, acq:'PROCESSING' },
  { id:'S5P-31288-1', sat:'Sentinel-5P', day:'2026-09-10', acqPct:41.00, acq:'ACQUIRING' }
];

export default function AcquisitionsGlobePage() {
  const [satFilter, setSatFilter] = useState('*');
  const [dayFilter, setDayFilter] = useState('*');
  const [dtkFilter, setDtkFilter] = useState(DATATAKES[0].id);

  const satellites = [...new Set(DATATAKES.map(d => d.sat))].sort();
  const days = [...new Set(DATATAKES.map(d => d.day))].sort().reverse();

  const filtered = DATATAKES.filter(d =>
    (satFilter === '*' || d.sat === satFilter) &&
    (dayFilter === '*' || d.day === dayFilter)
  );

  return (
    <div style={{ padding: '40px', background: '#000', color: '#eaf2fd', fontFamily: 'system-ui' }}>
      <h1>Acquisitions Status</h1>
      <p>Past, current and planned Sentinel acquisitions on an interactive 3D globe.</p>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', color: '#8ba6cc' }}>SATELLITE</label>
          <select value={satFilter} onChange={(e) => setSatFilter(e.target.value)} style={{ padding: '8px', background: '#0a1728', border: '1px solid #14335c', color: '#eaf2fd', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
            <option value="*">All satellites</option>
            {satellites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', color: '#8ba6cc' }}>DAY OF ACQUISITION</label>
          <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} style={{ padding: '8px', background: '#0a1728', border: '1px solid #14335c', color: '#eaf2fd', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
            <option value="*">Any day</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', color: '#8ba6cc' }}>LIST OF DATATAKES</label>
          <select value={dtkFilter} onChange={(e) => setDtkFilter(e.target.value)} style={{ padding: '8px', background: '#0a1728', border: '1px solid #14335c', color: '#eaf2fd', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', minWidth: '250px' }}>
            {filtered.map(d => <option key={d.id} value={d.id}>{d.id} · {d.sat} · {d.acqPct.toFixed(1)}% · {d.acq}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: '#0a1728', padding: '20px', borderRadius: '8px', border: '1px solid #14335c' }}>
        <h3>Selected Datatake</h3>
        {filtered.find(d => d.id === dtkFilter) && (
          <div>
            <p><strong>ID:</strong> {dtkFilter}</p>
            <p><strong>Satellite:</strong> {filtered.find(d => d.id === dtkFilter)?.sat}</p>
            <p><strong>Day:</strong> {filtered.find(d => d.id === dtkFilter)?.day}</p>
            <p><strong>Status:</strong> {filtered.find(d => d.id === dtkFilter)?.acq}</p>
            <p><strong>Completeness:</strong> {filtered.find(d => d.id === dtkFilter)?.acqPct.toFixed(1)}%</p>
          </div>
        )}
      </div>

      <p style={{ marginTop: '30px', fontSize: '12px', color: '#8ba6cc' }}>
        Showing {filtered.length} datatakes · {[...new Set(filtered.map(d => d.sat))].length} missions
      </p>
    </div>
  );
}

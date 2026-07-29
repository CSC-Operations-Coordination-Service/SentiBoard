import { useMemo, useState } from "react";
import { PageHeader, Reveal } from "@/components/ui";
import AcquisitionGlobe from "@/components/AcquisitionGlobe";
import FilterBar from "@/components/FilterBar";
import { STATIONS, ACQ_DATATAKES, type AcqDatatake } from "@/data/mock";

// ids look like "S2A_20260716T104201" — pull YYYY-MM-DD out for the date filter
function acquisitionDate(dt: AcqDatatake): string {
  const m = dt.id.match(/_(\d{4})(\d{2})(\d{2})T/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export default function Acquisitions() {
  const [selectedSats, setSelectedSats] = useState<string[]>([]);
  const [date, setDate] = useState("");

  const satellites = useMemo(
    () => Array.from(new Set(ACQ_DATATAKES.map((d) => d.sat))).sort(),
    []
  );

  const filtered = useMemo(() => {
    return ACQ_DATATAKES.filter((d) => {
      const satOk = selectedSats.length === 0 || selectedSats.includes(d.sat);
      const dateOk = !date || acquisitionDate(d) === date;
      return satOk && dateOk;
    });
  }, [selectedSats, date]);

  const toggleSat = (sat: string) =>
    setSelectedSats((prev) => (prev.includes(sat) ? prev.filter((s) => s !== sat) : [...prev, sat]));

  const resetFilters = () => { setSelectedSats([]); setDate(""); };

  return (
    <>
      <PageHeader crumb="Acquisitions Status" title="Acquisitions Status"
        sub="Past, current and future Copernicus Sentinels' acquisitions on an interactive 3D globe. Inspect the status of a past acquisition, or explore the planned acquisitions for the mission of interest. By default, the real-time sensing scenario is displayed." />

      <section className="wrap pad">
        <Reveal>
          <FilterBar
            satellites={satellites}
            selectedSats={selectedSats}
            onToggleSat={toggleSat}
            date={date}
            onDateChange={setDate}
            onReset={resetFilters}
            resultCount={filtered.length}
          />
          {filtered.length > 0 ? (
            <AcquisitionGlobe stations={STATIONS} datatakes={filtered} />
          ) : (
            <div style={{ padding: "48px 0", textAlign: "center", color: "rgba(205,217,236,.55)" }}>
              No datatakes match your filters.
            </div>
          )}
        </Reveal>
      </section>
    </>
  );
}

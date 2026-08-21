import { useMemo, useState } from "react";
import { PageHeader, Reveal } from "@/components/ui";
import AcquisitionGlobe from "@/components/AcquisitionGlobe";
import FilterBar from "@/components/FilterBar";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES, type AcqDatatake } from "@/data/mock";

// The date filter reads the sensing start off the record. It used to parse it out of the datatake
// id, which the dashboard's real id format (S1C-73089) does not carry.
function acquisitionDate(dt: AcqDatatake): string {
  return dt.startIso.slice(0, 10);
}

export default function Acquisitions() {
  const [selectedSats, setSelectedSats] = useState<string[]>([]);
  const [date, setDate] = useState("");

  const satellites = useMemo(
    () => Array.from(new Set(ACQ_DATATAKES.map((d) => d.sat))).sort(),
    []
  );

  // Days that actually carry acquisitions — the day filter uses these as its bounds
  // so it can never offer a future or empty date.
  const coveredDates = useMemo(
    () => Array.from(new Set(ACQ_DATATAKES.map(acquisitionDate).filter(Boolean))).sort(),
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
        sub="Past, current and future Copernicus Sentinels' acquisitions on an interactive 3D globe. Inspect the status of a past acquisition, or explore the planned acquisitions for the mission of interest. By default, the real-time sensing scenario is displayed."
        desc={ACQUISITIONS_DESCRIPTION} />

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
            coveredDates={coveredDates}
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

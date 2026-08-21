/* Datatake identifiers, in the dashboard's own format.
   ---------------------------------------------------------------------------
   The mock-ups used to carry a filename-style id — S3B_SRAL_20260822T224237_61EBE9 — which is a
   PRODUCT name, not a datatake one. The dashboard identifies a datatake by its satellite and its
   orbit bookkeeping, and the shape differs per mission:

     Sentinel-1   S1C-73089        datatake id
     Sentinel-2   S2C-10132-1      datatake id + segment    (segment omitted when there is one)
     Sentinel-3   S3A-142-380      cycle + relative orbit
     Sentinel-5P  S5P-45784        absolute orbit

   One consequence worth stating: the id no longer carries a timestamp, so nothing may parse a
   sensing time out of it any more. Every view that needs the time reads an explicit date field —
   which is how it should have been in the first place; an identifier is a name, not a record. */

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Build an id for a satellite. `rng` is the caller's seeded generator, so a given mock set keeps
 *  the same ids on every render. */
export function makeDatatakeId(satellite: string, rng: () => number): string {
  const sat = satellite.toUpperCase();

  if (sat.startsWith("S3")) {
    // cycle · relative orbit — Sentinel-3 repeats every 385 orbits
    const cycle = 100 + Math.floor(rng() * 300);
    const orbit = 1 + Math.floor(rng() * 385);
    return `${sat}-${pad(cycle, 3)}-${pad(orbit, 3)}`;
  }

  if (sat.startsWith("S2")) {
    const datatake = 10000 + Math.floor(rng() * 89999);
    // Most Sentinel-2 datatakes are cut into segments; a single-segment one carries no suffix.
    return rng() < 0.55 ? `${sat}-${datatake}-${1 + Math.floor(rng() * 9)}` : `${sat}-${datatake}`;
  }

  // Sentinel-1 and Sentinel-5P: one number
  return `${sat}-${10000 + Math.floor(rng() * 89999)}`;
}

/** Stable id for hand-written fixtures: same satellite + seed always gives the same id, so a
 *  literal written into one file can be matched by a literal in another (the downlink join). */
export function fixedDatatakeId(satellite: string, seed: number): string {
  let s = (seed * 2654435761) % 233280;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return makeDatatakeId(satellite, rng);
}

export interface AcqProductType {
  type: string;
  pct: number | null;
  instrument?: string;
}

export interface AcqLevel {
  level: "L0" | "L1" | "L2" | "UNKNOWN";
  products: AcqProductType[];
}

export interface AcqDatatake {
  id: string;
  sat: string;
  unit: string;
  station: string;
  lat: number;
  lon: number;
  swathKm: number;
  periodMin: number;
  startIso: string;
  sensingS: number;
  comp: number;
  cls: "ok" | "warn" | "crit";
  status: string;
  mode: string;
  absOrbit: string;
  levels: AcqLevel[];
  kmlLink?: { url: string; filename: string };
}

export interface Station {
  name: string;
  lat: number;
  lon: number;
}

export interface AcquisitionsData {
  datatakes: AcqDatatake[];
  stations: Station[];
}

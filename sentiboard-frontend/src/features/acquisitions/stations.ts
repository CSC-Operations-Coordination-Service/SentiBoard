import type { Station } from "./types";

// Five Copernicus core ground stations — real fixed positions, not mock data.
// Values from the prototype mock-up: AcquisitionsGlobeEarth.tsx STATIONS constant
// (~/work/SentiBoard/design/react-mockups/src/pages/acquisitions/).
export const COPERNICUS_STATIONS: Station[] = [
  { name: "Svalbard", lat: 78.23, lon: 15.4 },
  { name: "Matera", lat: 40.65, lon: 16.7 },
  { name: "Maspalomas", lat: 27.76, lon: -15.6 },
  { name: "Inuvik", lat: 68.36, lon: -133.7 },
  { name: "Neustrelitz", lat: 53.33, lon: 13.07 },
];

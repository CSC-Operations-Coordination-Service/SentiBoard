// Development only — removed in Slice 7 before merging to develop.
import type { AcqLevel, Station } from "./types";
import type { RawAcqDatatake } from "./adapter";

interface RawSpec {
  id: string;
  sat: string;
  unit: string;
  station: string;
  lat: number;
  lon: number;
  swathKm: number;
  periodMin: number;
  startOffsetS: number; // seconds before midnight of dayKey
  sensingS: number;
  status: string;
  mode: string;
  absOrbit: string;
  levels: AcqLevel[];
  kmlLink?: { url: string; filename: string };
}

const ACQ_RAW_SPECS: RawSpec[] = [
  {
    id: "S2A-48201-1",
    sat: "Sentinel-2A",
    unit: "S2A",
    station: "Svalbard",
    lat: 48.2,
    lon: 11.6,
    swathKm: 290,
    periodMin: 100.6,
    startOffsetS: 5040,
    sensingS: 205,
    status: "Published",
    mode: "MSI · NOBS",
    absOrbit: "048201",
    levels: [
      {
        level: "L0",
        products: [{ type: "MSI_L0__GR", pct: 100 }],
      },
      {
        level: "L1",
        products: [
          { type: "MSI_L1A_DS", pct: 100 },
          { type: "MSI_L1B_GR", pct: 100 },
          { type: "MSI_L1C_TC", pct: 100 },
        ],
      },
      {
        level: "L2",
        products: [{ type: "MSI_L2A_DS", pct: 100 }],
      },
    ],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s2a_mp_user_20260902t180959_20260924t202000",
      filename: "s2a_mp_user_20260903t171528_20260925t194000",
    },
  },
  {
    id: "S1C-57622",
    sat: "Sentinel-1C",
    unit: "S1C",
    station: "Matera",
    lat: 44.1,
    lon: 8.9,
    swathKm: 250,
    periodMin: 98.6,
    startOffsetS: 9360,
    sensingS: 130,
    status: "Processing",
    mode: "IW · DV",
    absOrbit: "057622",
    levels: [
      {
        level: "L0",
        products: [
          { type: "IW_RAW__0A", pct: 99, instrument: "SAR" },
          { type: "IW_RAW__0C", pct: 99, instrument: "SAR" },
          { type: "IW_RAW__0N", pct: 99, instrument: "SAR" },
          { type: "IW_RAW__0S", pct: 99, instrument: "SAR" },
        ],
      },
      {
        level: "L1",
        products: [
          { type: "IW_SLC__1A", pct: 62.8 },
          { type: "IW_SLC__1S", pct: 78.9 },
          { type: "IW_GRDH_1A", pct: 41.2 },
          { type: "IW_GRDH_1S", pct: 55.4 },
        ],
      },
      {
        level: "L2",
        products: [
          { type: "IW_OCN__2A", pct: null },
          { type: "IW_OCN__2S", pct: null },
        ],
      },
    ],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s1c_mp_user_20260902t180959_20260924t202000",
      filename: "s1c_mp_user_20260903t171528_20260925t194000",
    },
  },
  {
    id: "S3B-080-345",
    sat: "Sentinel-3B",
    unit: "S3B",
    station: "Maspalomas",
    lat: 30.4,
    lon: -13.2,
    swathKm: 1270,
    periodMin: 100.99,
    startOffsetS: 14760,
    sensingS: 183,
    status: "Processing",
    mode: "OLCI · EFR",
    absOrbit: "031145",
    levels: [
      {
        level: "L1",
        products: [
          { type: "OL_1_EFR", pct: 93.5 },
          { type: "SL_1_RBT", pct: 96.5 },
        ],
      },
      {
        level: "L2",
        products: [
          { type: "OL_2_WFR", pct: 88 },
          { type: "SL_2_LST", pct: 96 },
          { type: "SR_2_LAN", pct: 88.5 },
        ],
      },
    ],
  },
  {
    id: "S2B-42050-1",
    sat: "Sentinel-2B",
    unit: "S2B",
    station: "Inuvik",
    lat: 63.1,
    lon: -126.4,
    swathKm: 290,
    periodMin: 100.6,
    startOffsetS: 17640,
    sensingS: 252,
    status: "Published",
    mode: "MSI · NOBS",
    absOrbit: "042050",
    levels: [
      {
        level: "L0",
        products: [{ type: "MSI_L0__GR", pct: 99.4 }],
      },
      {
        level: "L1",
        products: [
          { type: "MSI_L1A_DS", pct: 100 },
          { type: "MSI_L1B_GR", pct: 100 },
          { type: "MSI_L1C_TC", pct: 100 },
        ],
      },
      {
        level: "L2",
        products: [{ type: "MSI_L2A_DS", pct: 100 }],
      },
    ],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s2b_mp_user_20260902t180959_20260924t202000",
      filename: "s2b_mp_user_20260903t171528_20260925t194000",
    },
  },
  {
    id: "S5P-60012",
    sat: "Sentinel-5P",
    unit: "S5P",
    station: "Neustrelitz",
    lat: 51.4,
    lon: 19.8,
    swathKm: 2600,
    periodMin: 101.3,
    startOffsetS: 22320,
    sensingS: 400,
    status: "Published",
    mode: "TROPOMI · NOMINAL",
    absOrbit: "060012",
    levels: [
      {
        level: "L2",
        products: [
          { type: "L2__NO2___", pct: 92.4 },
          { type: "L2__O3____", pct: 94.1 },
          { type: "L2__CO____", pct: 99 },
          { type: "L2__CH4___", pct: 97 },
          { type: "L2__HCHO__", pct: 99 },
          { type: "L2__SO2___", pct: 99 },
          { type: "L2__AER_AI", pct: 98.5 },
        ],
      },
    ],
  },
  {
    id: "S1A-60418",
    sat: "Sentinel-1A",
    unit: "S1A",
    station: "Svalbard",
    lat: 61.8,
    lon: -24.5,
    swathKm: 400,
    periodMin: 98.6,
    startOffsetS: 29880,
    sensingS: 240,
    status: "Published",
    mode: "EW · DH",
    absOrbit: "060418",
    levels: [
      {
        level: "L0",
        products: [
          { type: "EW_RAW__0A", pct: 100, instrument: "SAR" },
          { type: "EW_RAW__0C", pct: 100, instrument: "SAR" },
          { type: "EW_RAW__0N", pct: 100, instrument: "SAR" },
          { type: "EW_RAW__0S", pct: 100, instrument: "SAR" },
        ],
      },
      {
        level: "L1",
        products: [
          { type: "EW_GRDM_1A", pct: 99.6 },
          { type: "EW_GRDM_1S", pct: 99.2 },
        ],
      },
      {
        level: "L2",
        products: [
          { type: "EW_OCN__2A", pct: null },
          { type: "EW_OCN__2S", pct: null },
        ],
      },
    ],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s1a_mp_user_20260902t180959_20260924t202000",
      filename: "s1a_mp_user_20260903t171528_20260925t194000",
    },
  },
  {
    id: "S2C-10187-1",
    sat: "Sentinel-2C",
    unit: "S2C",
    station: "Maspalomas",
    lat: 14.6,
    lon: 2.1,
    swathKm: 290,
    periodMin: 100.6,
    startOffsetS: 36720,
    sensingS: 232,
    status: "Processing",
    mode: "MSI · NOBS",
    absOrbit: "010187",
    levels: [
      {
        level: "L0",
        products: [{ type: "MSI_L0__GR", pct: 100 }],
      },
      {
        level: "L1",
        products: [
          { type: "MSI_L1A_DS", pct: 100 },
          { type: "MSI_L1B_GR", pct: 97.8 },
          { type: "MSI_L1C_TC", pct: 91.5 },
        ],
      },
      {
        level: "L2",
        products: [{ type: "MSI_L2A_DS", pct: 64 }],
      },
    ],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s2c_mp_user_20260902t180959_20260924t202000",
      filename: "s2c_mp_user_20260903t171528_20260925t194000",
    },
  },
  {
    id: "S3A-055-358",
    sat: "Sentinel-3A",
    unit: "S3A",
    station: "Svalbard",
    lat: 71.6,
    lon: 24.3,
    swathKm: 1400,
    periodMin: 100.99,
    startOffsetS: 50760,
    sensingS: 108,
    status: "Failed",
    mode: "SLSTR · SL",
    absOrbit: "021533",
    levels: [
      {
        level: "L0",
        products: [{ type: "SL_0_SLT", pct: 0 }],
      },
      {
        level: "L1",
        products: [{ type: "SL_1_RBT", pct: 0 }],
      },
      {
        level: "L2",
        products: [{ type: "SL_2_LST", pct: null }],
      },
      {
        level: "UNKNOWN",
        products: [{ type: "OUT_OF_MONITORING", pct: null }],
      },
    ],
  },
  {
    id: "S3A-112-207",
    sat: "Sentinel-3A",
    unit: "S3A",
    station: "Matera",
    lat: -8.4,
    lon: 72.6,
    swathKm: 1270,
    periodMin: 100.99,
    startOffsetS: 59400,
    sensingS: 300,
    status: "Published",
    mode: "OLCI · EFR",
    absOrbit: "021540",
    levels: [
      {
        level: "L0",
        products: [
          { type: "OL_0_EFR", pct: 100 },
          { type: "SL_0_SLT", pct: 100 },
        ],
      },
      {
        level: "L1",
        products: [
          { type: "OL_1_EFR", pct: 99.4 },
          { type: "OL_1_ERR", pct: 99.1 },
          { type: "SL_1_RBT", pct: 98.7 },
        ],
      },
      {
        level: "L2",
        products: [
          { type: "OL_2_WFR", pct: 97.9 },
          { type: "OL_2_LFR", pct: 98.8 },
          { type: "SL_2_WST", pct: 99 },
        ],
      },
    ],
  },
  {
    id: "S5P-60011",
    sat: "Sentinel-5P",
    unit: "S5P",
    station: "Inuvik",
    lat: 18.9,
    lon: -88.4,
    swathKm: 2600,
    periodMin: 101.3,
    startOffsetS: 65520,
    sensingS: 420,
    status: "Published",
    mode: "TROPOMI · NOMINAL",
    absOrbit: "060011",
    levels: [
      {
        level: "L1",
        products: [
          { type: "L1B_RA_BD1", pct: 100 },
          { type: "L1B_RA_BD2", pct: 100 },
          { type: "L1B_RA_BD3", pct: 99.5 },
          { type: "L1B_RA_BD4", pct: 99.5 },
        ],
      },
      {
        level: "L2",
        products: [
          { type: "L2__NO2___", pct: 98.2 },
          { type: "L2__O3____", pct: 99 },
          { type: "L2__CO____", pct: 99 },
          { type: "L2__CH4___", pct: 96.4 },
        ],
      },
    ],
  },
  {
    id: "S1C-57611",
    sat: "Sentinel-1C",
    unit: "S1C",
    station: "Neustrelitz",
    lat: 36.9,
    lon: 139.4,
    swathKm: 250,
    periodMin: 98.6,
    startOffsetS: 74520,
    sensingS: 175,
    status: "Processing",
    mode: "IW · DV",
    absOrbit: "057611",
    levels: [
      {
        level: "L0",
        products: [
          { type: "IW_RAW__0A", pct: 100, instrument: "SAR" },
          { type: "IW_RAW__0S", pct: 100, instrument: "SAR" },
        ],
      },
      {
        level: "L1",
        products: [
          { type: "IW_SLC__1S", pct: 88 },
          { type: "IW_GRDH_1S", pct: 81.5 },
        ],
      },
      {
        level: "L2",
        products: [{ type: "IW_OCN__2S", pct: null }],
      },
    ],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s1c_mp_user_20260902t180959_20260924t202000",
      filename: "s1c_mp_user_20260903t171528_20260925t194000",
    },
  },
];

const STATIONS: Station[] = [
  { name: "Svalbard", lat: 78.23, lon: 15.4 },
  { name: "Matera", lat: 40.65, lon: 16.7 },
  { name: "Maspalomas", lat: 27.76, lon: -15.6 },
  { name: "Inuvik", lat: 68.36, lon: -133.7 },
  { name: "Neustrelitz", lat: 53.33, lon: 13.07 },
];

export function getMockData(dayKey: string): { datatakes: RawAcqDatatake[]; stations: Station[] } {
  const dayStart = new Date(dayKey + "T00:00:00Z").getTime();
  return {
    datatakes: ACQ_RAW_SPECS.map(({ startOffsetS, ...rest }) => ({
      ...rest,
      startIso: new Date(dayStart - startOffsetS * 1000).toISOString(),
    })),
    stations: STATIONS,
  };
}

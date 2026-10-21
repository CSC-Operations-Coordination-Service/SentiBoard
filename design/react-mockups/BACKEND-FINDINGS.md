# Backend findings

Data issues found while wiring the React frontend to the FastAPI backend. Each finding gives the
endpoint, what was checked, and the affected record ids.

## Processor (`GET /processor/`)

### Release notes contain unfilled template placeholders

Some `release_notes` still hold placeholder text from the announcement template: `Sentinel-n`
where the mission number belongs, and `TBD` where a product name or deployment date belongs.
The frontend shows these notes as they are, so the placeholders appear on the public Processors
page.

Checked on 2026-10-21 against all 228 records returned by `GET /processor/?limit=1000` (local
backend). Matching was done on the notes' text with HTML tags removed, as whole words
(`\bTBD\b`, `\bSentinel-n\b`).

- `TBD`: 3 records
- `Sentinel-n`: 2 records (both also contain `TBD`)
- Total affected: **3 records**, all Sentinel-3

| id | target_ipfs | validity_start_date | Placeholder text |
|---|---|---|---|
| `15cc6ca8_b04c_11f1_953a_0242ac110002` | `S3_OL1:06.20`, `S3_SL1:06.25` | 2026-07-29 | "Copernicus Sentinel-n TBD Products: New Processing Baseline"; "deployed on TBD for S3A and S3B" |
| `580963b4_2e97_11f1_a77e_0242ac110002` | `S3_SM2_HY:7.10`, `S3_SM2_LI:7.10`, `S3_SM2_SI:7.10` | 2026-02-06 | "Copernicus Sentinel-n TBD Products: New Processing Baseline"; "processing baseline ID for Copernicus Sentinel-n concerning…" |
| `65d6a656_2e96_11f1_a9f7_0242ac110002` | `S3_OL1_RAC:6.18`, `S3_PUG:3.51`, `S3_SL1:06.24`, `S3_SL2:06.25`, `S3_SL2_FRP:01.13`, `S3_SY2:06.31`, `S3_SY2_AOD:01.11`, `S3_SY2_VGS:06.14` | 2026-04-01 | "deployed on TBD for S3A and S3B" |

The first record is the S3 OL1 06.20 / SL1 06.25 release (`processing_baseline` "3.37"), which
the Processors page shows as the current baseline for both processors.

**Suggested action:** fill in the placeholders in these three records, with the mission
(`Sentinel-3`), the product names and the deployment date. Consider rejecting or flagging
`Sentinel-n` and `TBD` when release notes are written.

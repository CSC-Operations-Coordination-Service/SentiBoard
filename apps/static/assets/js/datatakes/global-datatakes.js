/*
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
*/

const formatDataDetail = [];
const globaldatatakesarray = [];

const monthsData = [
    {
        name: "Jan",
        data: [
            { x: "2025-01-01", y: 20, id: "S1A-476025 (74379)", platform: "S1A (WV)", start: "2025-01-01T08:42:00", stop: "2025-01-01T23:47:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-02", y: 25, id: "S1A-476026 (7437a)", platform: "S1A (WV)", start: "2025-01-02T01:44:00", stop: "2025-01-02T20:09:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-01-03", y: 20, id: "S1A-476027 (7437b)", platform: "S1A (WV)", start: "2025-01-03T08:32:00", stop: "2025-01-03T18:41:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-04", y: 4, id: "S1A-476058 (7439a)", platform: "S1A (WV)", start: "2025-01-04T03:41:00", stop: "2025-01-04T19:52:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-01-05", y: 25, id: "S1A-42398-2", platform: "S1A (WV)", start: "2025-01-05T03:02:00", stop: "2025-01-05T21:45:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-06", y: 22, id: "S1A-476060 (7439c)", platform: "S1A (WV)", start: "2025-01-06T08:16:00", stop: "2025-01-06T15:07:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-07", y: 29, id: "S1A-476061 (7439d)", platform: "S1A (WV)", start: "2025-01-07T01:21:00", stop: "2025-01-07T17:13:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-08", y: 23, id: "S1A-42387-3", platform: "S1A (WV)", start: "2025-01-08T05:09:00", stop: "2025-01-08T15:41:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-01-09", y: 3, id: "S1A-476063 (7439f)", platform: "S1A (WV)", start: "2025-01-09T06:23:00", stop: "2025-01-09T14:10:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-01-10", y: 21, id: "S1A-476064 (743a0)", platform: "S1A (WV)", start: "2025-01-10T04:11:00", stop: "2025-01-10T15:56:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-11", y: 28, id: "S1C-42338-1", platform: "S1A (WV)", start: "2025-01-11T07:47:00", stop: "2025-01-11T20:35:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-12", y: 23, id: "S1A-476066 (743a2)", platform: "S1A (WV)", start: "2025-01-12T03:14:00", stop: "2025-01-12T18:22:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-01-13", y: 22, id: "S1A-476067 (743a3)", platform: "S1A (WV)", start: "2025-01-13T01:58:00", stop: "2025-01-13T22:01:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-14", y: 2, id: "S1A-476068 (743a4)", platform: "S1A (WV)", start: "2025-01-14T04:32:00", stop: "2025-01-14T15:26:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-01-15", y: 22, id: "S1C-3213-2", platform: "S1C", start: "2025-01-15T05:08:00", stop: "2025-01-15T18:51:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-16", y: 28, id: "S1A-476070 (743a6)", platform: "S1A (WV)", start: "2025-01-16T08:31:00", stop: "2025-01-16T17:28:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-17", y: 29, id: "S1A-386301", platform: "S1A", start: "2025-01-17T01:10:00", stop: "2025-01-17T21:34:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-01-18", y: 23, id: "S1A-476072 (743a8)", platform: "S1A (WV)", start: "2025-01-18T02:12:00", stop: "2025-01-18T22:21:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-19", y: 27, id: "S1A-476073 (743a9)", platform: "S1A (WV)", start: "2025-01-19T06:00:00", stop: "2025-01-19T19:09:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-20", y: 27, id: "S1C-105-276", platform: "S1C", start: "2025-01-20T03:39:00", stop: "2025-01-20T14:03:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-21", y: 1, id: "S1C-105002", platform: "S1C", start: "2025-01-21T02:22:00", stop: "2025-01-21T23:19:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-01-22", y: 24, id: "S1A-476076 (743ac)", platform: "S1A (WV)", start: "2025-01-22T08:40:00", stop: "2025-01-22T14:00:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-23", y: 26, id: "S1A-38829", platform: "S1A", start: "2025-01-23T05:33:00", stop: "2025-01-23T15:21:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-24", y: 22, id: "S1A-476078 (743ae)", platform: "S1A (WV)", start: "2025-01-24T02:03:00", stop: "2025-01-24T17:47:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-01-25", y: 25, id: "S1A-476079 (743af)", platform: "S1A (WV)", start: "2025-01-25T07:09:00", stop: "2025-01-25T19:19:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-26", y: 24, id: "S1A-38925", platform: "S1A", start: "2025-01-26T06:27:00", stop: "2025-01-26T14:39:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-27", y: 26, id: "S1A-476081 (743b1)", platform: "S1A (WV)", start: "2025-01-27T03:12:00", stop: "2025-01-27T21:30:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-01-28", y: 27, id: "S1A-476082 (743b2)", platform: "S1A (WV)", start: "2025-01-28T01:33:00", stop: "2025-01-28T15:05:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-29", y: 28, id: "S1A-476083 (743b3)", platform: "S1A (WV)", start: "2025-01-29T02:55:00", stop: "2025-01-29T18:22:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-01-30", y: 23, id: "S1A-476084 (743b4)", platform: "S1A (WV)", start: "2025-01-30T06:41:00", stop: "2025-01-30T20:39:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-01-31", y: 21, id: "S1A-476085 (743b5)", platform: "S1A (WV)", start: "2025-01-31T04:13:00", stop: "2025-01-31T22:49:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" }
        ]
    },
    {
        name: "Feb",
        data: [
            { x: "2025-02-01", y: 25, id: "S2A-51195-4", platform: "S2A (NOBS)", start: "2025-02-01T03:02:00", stop: "2025-02-01T20:18:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-02", y: 28, id: "S2B-475497-2", platform: "S2B (NOBS)", start: "2025-02-02T02:34:00", stop: "2025-02-02T20:59:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-03", y: 22, id: "S2C-42288-2", platform: "S2C (NOBS)", start: "2025-02-03T04:12:00", stop: "2025-02-03T18:14:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-04", y: 22, id: "S3A_20250404144656047681", platform: "S3A", start: "2025-02-04T08:56:00", stop: "2025-02-04T17:22:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-02-05", y: 2, id: "S3B_20250404054523036282", platform: "S3B", start: "2025-02-05T07:11:00", stop: "2025-02-05T19:35:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-02-06", y: 24, id: "S5P-38630", platform: "S5P", start: "2025-02-06T06:45:00", stop: "2025-02-06T15:15:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-07", y: 21, id: "S1A-476092 (743bc)", platform: "S1A (WV)", start: "2025-02-07T02:14:00", stop: "2025-02-07T22:31:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-08", y: 29, id: "S2A-51196-5", platform: "S2A (NOBS)", start: "2025-02-08T01:22:00", stop: "2025-02-08T22:08:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-09", y: 13, id: "S2B-475498-3", platform: "S2B (NOBS)", start: "2025-02-09T03:14:00", stop: "2025-02-09T15:05:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-10", y: 24, id: "S2C-42289-3", platform: "S2C (NOBS)", start: "2025-02-10T04:51:00", stop: "2025-02-10T18:39:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-11", y: 26, id: "S3A_20250411144656047681", platform: "S3A", start: "2025-02-11T08:45:00", stop: "2025-02-11T16:17:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-12", y: 24, id: "S3B_20250411054523036282", platform: "S3B", start: "2025-02-12T07:39:00", stop: "2025-02-12T18:51:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-02-13", y: 4, id: "S5P-38631", platform: "S5P", start: "2025-02-13T06:18:00", stop: "2025-02-13T15:32:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-02-14", y: 8, id: "S1A-476099 (743c3)", platform: "S1A (WV)", start: "2025-02-14T02:37:00", stop: "2025-02-14T20:49:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-15", y: 20, id: "S2A-51197-6", platform: "S2A (NOBS)", start: "2025-02-15T04:29:00", stop: "2025-02-15T19:54:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-16", y: 22, id: "S2B-475499-4", platform: "S2B (NOBS)", start: "2025-02-16T02:57:00", stop: "2025-02-16T20:13:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-17", y: 29, id: "S2C-42290-4", platform: "S2C (NOBS)", start: "2025-02-17T06:45:00", stop: "2025-02-17T17:11:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-18", y: 2, id: "S3A_20250418144656047681", platform: "S3A", start: "2025-02-18T08:05:00", stop: "2025-02-18T16:29:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-02-19", y: 26, id: "S3B_20250418054523036282", platform: "S3B", start: "2025-02-19T07:12:00", stop: "2025-02-19T17:36:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-20", y: 13, id: "S5P-38632", platform: "S5P", start: "2025-02-20T03:56:00", stop: "2025-02-20T15:03:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-02-21", y: 20, id: "S1A-476105 (743c9)", platform: "S1A (WV)", start: "2025-02-21T02:12:00", stop: "2025-02-21T20:54:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-22", y: 25, id: "S1A-476106 (743ca)", platform: "S1A (WV)", start: "2025-02-22T01:47:00", stop: "2025-02-22T19:42:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-23", y: 27, id: "S1A-476107 (743cb)", platform: "S1A (WV)", start: "2025-02-23T04:18:00", stop: "2025-02-23T17:11:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-24", y: 3, id: "S1A-476108 (743cc)", platform: "S1A (WV)", start: "2025-02-24T06:13:00", stop: "2025-02-24T16:36:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-02-25", y: 28, id: "S1A-476109 (743cd)", platform: "S1A (WV)", start: "2025-02-25T07:51:00", stop: "2025-02-25T15:23:00", acquisition: "PROCESSING", publication: "PROCESSING (28%)" },
            { x: "2025-02-26", y: 21, id: "S1A-476110 (743ce)", platform: "S1A (WV)", start: "2025-02-26T04:37:00", stop: "2025-02-26T18:19:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-27", y: 24, id: "S1A-476111 (743cf)", platform: "S1A (WV)", start: "2025-02-27T02:44:00", stop: "2025-02-27T20:59:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-02-28", y: 13, id: "S1A-476112 (743d0)", platform: "S1A (WV)", start: "2025-02-28T06:21:00", stop: "2025-02-28T17:08:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-02-29", y: 26, id: "S1A-476113 (743d1)", platform: "S1A (WV)", start: "2025-02-29T04:16:00", stop: "2025-02-29T15:52:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" }
        ]
    },
    {
        name: "Mar",
        data: [
            { x: "2025-03-01", y: 21, id: "S2A-51201-1", platform: "S2A", start: "2025-03-01T00:00:00", stop: "2025-03-01T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (90%)" },
            { x: "2025-03-02", y: 22, id: "S2B-475501-2", platform: "S2B", start: "2025-03-02T00:00:00", stop: "2025-03-02T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (90%)" },
            { x: "2025-03-03", y: 23, id: "S2C-42291-3", platform: "S2C", start: "2025-03-03T00:00:00", stop: "2025-03-03T00:10:00", acquisition: "PLANNED", publication: "PROCESSING (90%)" },
            { x: "2025-03-04", y: 24, id: "S3A_20250304123456011111", platform: "S3A", start: "2025-03-04T12:34:56", stop: "2025-03-04T12:35:56", acquisition: "PROCESSING", publication: "PLANNED (90%)" },
            { x: "2025-03-05", y: 22, id: "S3B_20250305054523039999", platform: "S3B", start: "2025-03-05T05:45:23", stop: "2025-03-05T05:55:23", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-06", y: 21, id: "S5P-38633", platform: "S5P", start: "2025-03-06T00:00:00", stop: "2025-03-06T00:10:00", acquisition: "PARTIAL", publication: "PUBLISHED (90%)" },
            { x: "2025-03-07", y: 24, id: "S2A-51202-2", platform: "S2A", start: "2025-03-07T00:00:00", stop: "2025-03-07T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (90%)" },
            { x: "2025-03-08", y: 23, id: "S2B-475502-3", platform: "S2B", start: "2025-03-08T00:00:00", stop: "2025-03-08T00:10:00", acquisition: "PLANNED", publication: "PLANNED (60%)" },
            { x: "2025-03-09", y: 21, id: "S2C-42292-4", platform: "S2C", start: "2025-03-09T00:00:00", stop: "2025-03-09T00:10:00", acquisition: "UNAVAILABLE", publication: "PROCESSING (60%)" },
            { x: "2025-03-10", y: 22, id: "S3A-124-320", platform: "S3A", start: "2025-03-10T00:00:00", stop: "2025-03-10T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (90%)" },
            { x: "2025-03-11", y: 24, id: "S3B_20250311054523038888", platform: "S3B", start: "2025-03-11T05:45:23", stop: "2025-03-11T05:55:23", acquisition: "PROCESSING", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-12", y: 23, id: "S5P-38634", platform: "S5P", start: "2025-03-12T00:00:00", stop: "2025-03-12T00:10:00", acquisition: "PARTIAL", publication: "PLANNED (90%)" },
            { x: "2025-03-13", y: 22, id: "S2A-51203-3", platform: "S2A", start: "2025-03-13T00:00:00", stop: "2025-03-13T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (95%)" },
            { x: "2025-03-14", y: 21, id: "S2B-475503-4", platform: "S2B", start: "2025-03-14T00:00:00", stop: "2025-03-14T00:10:00", acquisition: "PLANNED", publication: "PROCESSING (70%)" },
            { x: "2025-03-15", y: 23, id: "S2C-42293-5", platform: "S2C", start: "2025-03-15T00:00:00", stop: "2025-03-15T00:10:00", acquisition: "UNAVAILABLE", publication: "PROCESSING (80%)" },
            { x: "2025-03-16", y: 22, id: "S3A_20250316144656047681", platform: "S3A", start: "2025-03-16T14:46:56", stop: "2025-03-16T14:47:56", acquisition: "ACQUIRED", publication: "PUBLISHED (99%)" },
            { x: "2025-03-17", y: 23, id: "S3B_20250317054523036282", platform: "S3B", start: "2025-03-17T05:45:23", stop: "2025-03-17T05:55:23", acquisition: "PARTIAL", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-18", y: 4, id: "S5P-38635", platform: "S5P", start: "2025-03-18T00:00:00", stop: "2025-03-18T00:10:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-19", y: 21, id: "S1A-476130", platform: "S1A", start: "2025-03-19T00:00:00", stop: "2025-03-19T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (98%)" },
            { x: "2025-03-20", y: 22, id: "S1A-476131", platform: "S1A", start: "2025-03-20T00:00:00", stop: "2025-03-20T00:10:00", acquisition: "PLANNED", publication: "PROCESSING (60%)" },
            { x: "2025-03-21", y: 23, id: "S1A-476132", platform: "S1A", start: "2025-03-21T00:00:00", stop: "2025-03-21T00:10:00", acquisition: "PROCESSING", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-22", y: 24, id: "S1A-476133", platform: "S1A", start: "2025-03-22T00:00:00", stop: "2025-03-22T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (94%)" },
            { x: "2025-03-23", y: 11, id: "S1A-476134", platform: "S1A", start: "2025-03-23T00:00:00", stop: "2025-03-23T00:10:00", acquisition: "PLANNED", publication: "PROCESSING (90%)" },
            { x: "2025-03-24", y: 22, id: "S1A-476135", platform: "S1A", start: "2025-03-24T00:00:00", stop: "2025-03-24T00:10:00", acquisition: "PROCESSING", publication: "PLANNED (70%)" },
            { x: "2025-03-25", y: 23, id: "S1A-476136", platform: "S1A", start: "2025-03-25T00:00:00", stop: "2025-03-25T00:10:00", acquisition: "PARTIAL", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-26", y: 4, id: "S1A-476137", platform: "S1A", start: "2025-03-26T00:00:00", stop: "2025-03-26T00:10:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (90%)" },
            { x: "2025-03-27", y: 21, id: "S1A-476138", platform: "S1A", start: "2025-03-27T00:00:00", stop: "2025-03-27T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (85%)" },
            { x: "2025-03-28", y: 22, id: "S1A-476139", platform: "S1A", start: "2025-03-28T00:00:00", stop: "2025-03-28T00:10:00", acquisition: "PROCESSING", publication: "PROCESSING (50%)" },
            { x: "2025-03-29", y: 3, id: "S1A-476140", platform: "S1A", start: "2025-03-29T00:00:00", stop: "2025-03-29T00:10:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (0%)" },
            { x: "2025-03-30", y: 24, id: "S1A-476141", platform: "S1A", start: "2025-03-30T00:00:00", stop: "2025-03-30T00:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (95%)" },
            { x: "2025-03-31", y: 21, id: "S1A-476142", platform: "S1A", start: "2025-03-31T00:00:00", stop: "2025-03-31T00:10:00", acquisition: "PLANNED", publication: "PROCESSING (49%)" }
        ]
    }, {
        name: "Apr",
        data: [
            { x: "2025-04-13", y: 21, id: "S2A-51301-1", platform: "S2A", start: "2025-04-13T00:10:00", stop: "2025-04-13T12:30:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 22, id: "S2B-475601-2", platform: "S2B", start: "2025-04-13T02:10:00", stop: "2025-04-13T14:25:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 23, id: "S2C-42301-3", platform: "S2C", start: "2025-04-13T03:50:00", stop: "2025-04-13T15:40:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-04-13", y: 24, id: "S3A_20250404123456012345", platform: "S3A", start: "2025-04-13T01:10:00", stop: "2025-04-13T13:20:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 23, id: "S3B_20250405054523031111", platform: "S3B", start: "2025-04-13T04:30:00", stop: "2025-04-13T16:50:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 22, id: "S5P-38650", platform: "S5P", start: "2025-04-13T06:45:00", stop: "2025-04-13T18:00:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-04-13", y: 21, id: "S2A-51302-2", platform: "S2A", start: "2025-04-13T00:20:00", stop: "2025-04-13T12:40:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 24, id: "S1A-476025 (74379)", platform: "S1A", start: "2025-04-13T02:30:00", stop: "2025-04-13T14:00:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 22, id: "S2C-42302-4", platform: "S2C", start: "2025-04-13T03:00:00", stop: "2025-04-13T15:10:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 23, id: "S3A_20250410111111113333", platform: "S3A", start: "2025-04-13T04:30:00", stop: "2025-04-13T16:30:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 21, id: "S3B_20250411054523034444", platform: "S3B", start: "2025-04-13T02:00:00", stop: "2025-04-13T14:40:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-04-13", y: 24, id: "S5P-38651", platform: "S5P", start: "2025-04-12T06:00:00", stop: "2025-04-12T18:15:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 22, id: "S2A-51303-3", platform: "S2A", start: "2025-04-13T00:25:00", stop: "2025-04-13T12:50:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 23, id: "S2B-475603-4", platform: "S2B", start: "2025-04-13T03:00:00", stop: "2025-04-13T15:30:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-04-13", y: 1, id: "S2C-42303-5", platform: "S2C", start: "2025-04-13T04:15:00", stop: "2025-04-13T16:10:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-04-13", y: 4, id: "S3A_20250416144656045555", platform: "S3A", start: "2025-04-13T02:05:00", stop: "2025-04-13T13:45:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 6, id: "S3B_20250417054523036666", platform: "S3B", start: "2025-04-13T03:20:00", stop: "2025-04-13T15:30:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 19, id: "S5P-38652", platform: "S5P", start: "2025-04-13T06:10:00", stop: "2025-04-18T18:45:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-04-13", y: 28, id: "S1A-476160 (74400)", platform: "S1A", start: "2025-04-13T01:00:00", stop: "2025-04-13T13:20:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 23, id: "S1A-476161 (74401)", platform: "S1A", start: "2025-04-13T04:30:00", stop: "2025-04-13T16:00:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 24, id: "S1A-476162 (74402)", platform: "S1A", start: "2025-04-13T03:15:00", stop: "2025-04-13T15:40:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-04-13", y: 21, id: "S1A-476163 (74403)", platform: "S1A", start: "2025-04-13T02:45:00", stop: "2025-04-13T14:10:00", acquisition: "UNAVAILABLE", publication: "UNAVAILABLE (3%)" },
            { x: "2025-04-13", y: 13, id: "S1A-476164 (74404)", platform: "S1A", start: "2025-04-13T01:55:00", stop: "2025-04-13T13:40:00", acquisition: "ACQUIRED", publication: "PUBLISHED (100.0%)" },
            { x: "2025-04-13", y: 14, id: "S1A-476165 (74405)", platform: "S1A", start: "2025-04-13T04:40:00", stop: "2025-04-13T16:50:00", acquisition: "PROCESSING", publication: "PROCESSING (12.7%)" },
            { x: "2025-04-13", y: 14, id: "S1A-476166 (74406)", platform: "S1A", start: "2025-04-13T03:30:00", stop: "2025-04-13T15:00:00", acquisition: "PARTIAL", publication: "PROCESSING (28%)" },
            { x: "2025-04-13", y: 14, id: "S1A-476167 (74407)", platform: "S1A", start: "2025-04-13T02:00:00", stop: "2025-04-13T14:25:00", acquisition: "PLANNED", publication: "PLANNED (100.0%)" },
            { x: "2025-04-13", y: 11, id: "S1A-476168 (74408)", platform: "S1A", start: "2025-04-13T04:50:00", stop: "2025-04-13T16:40:00", acquisition: "PLANNED", publication: "PLANNED (12.7%)" },
            { x: "2025-04-13", y: 11, id: "S1A-476169 (74409)", platform: "S1A", start: "2025-04-13T01:40:00", stop: "2025-04-13T13:30:00", acquisition: "PLANNED", publication: "PLANNED (28%)" },
            { x: "2025-04-13", y: 12, id: "S1A-476170 (74410)", platform: "S1A", start: "2025-04-13T02:30:00", stop: "2025-04-13T14:15:00", acquisition: "PLANNED", publication: "PLANNED (3%)" },
            { x: "2025-04-13", y: 13, id: "S1A-476171 (74411)", platform: "S1A", start: "2025-04-13T03:40:00", stop: "2025-04-13T15:20:00", acquisition: "PLANNED", publication: "PLANNED (100.0%)" }
        ]
    },
    {
        name: "May",
        data: [
            { x: "2025-05-01", y: 12, id: "S1A-476200 (744a1)", platform: "S1A", start: "2025-05-01T00:15:00", stop: "2025-05-01T12:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-02", y: 12, id: "S2A-511980 (744a2)", platform: "S2A", start: "2025-05-02T01:30:00", stop: "2025-05-02T13:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-03", y: 12, id: "S2B-423380 (744a3)", platform: "S2B", start: "2025-05-03T02:00:00", stop: "2025-05-03T14:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-04", y: 14, id: "S3A-125034 (744a4)", platform: "S3A", start: "2025-05-04T03:20:00", stop: "2025-05-04T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-05", y: 12, id: "S3B-105275 (744a5)", platform: "S3B", start: "2025-05-05T04:30:00", stop: "2025-05-05T16:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-06", y: 11, id: "S5P-388290 (744a6)", platform: "S5P", start: "2025-05-06T05:45:00", stop: "2025-05-06T18:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-07", y: 12, id: "S1A-476201 (744a7)", platform: "S1A", start: "2025-05-07T00:30:00", stop: "2025-05-07T12:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-08", y: 13, id: "S2A-511981 (744a8)", platform: "S2A", start: "2025-05-08T01:40:00", stop: "2025-05-08T13:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-09", y: 12, id: "S2B-423381 (744a9)", platform: "S2B", start: "2025-05-09T02:10:00", stop: "2025-05-09T14:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-10", y: 12, id: "S3A-125035 (744aa)", platform: "S3A", start: "2025-05-10T03:30:00", stop: "2025-05-10T15:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-11", y: 12, id: "S3B-105276 (744ab)", platform: "S3B", start: "2025-05-11T04:10:00", stop: "2025-05-11T16:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-12", y: 12, id: "S5P-388291 (744ac)", platform: "S5P", start: "2025-05-12T05:25:00", stop: "2025-05-12T17:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-13", y: 14, id: "S1A-476202 (744ad)", platform: "S1A", start: "2025-05-13T00:45:00", stop: "2025-05-13T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-14", y: 12, id: "S2A-511982 (744ae)", platform: "S2A", start: "2025-05-14T02:00:00", stop: "2025-05-14T14:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-15", y: 12, id: "S2B-423382 (744af)", platform: "S2B", start: "2025-05-15T03:30:00", stop: "2025-05-15T15:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-16", y: 11, id: "S3A-125036 (744b0)", platform: "S3A", start: "2025-05-16T02:10:00", stop: "2025-05-16T14:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-17", y: 12, id: "S3B-105277 (744b1)", platform: "S3B", start: "2025-05-17T01:55:00", stop: "2025-05-17T14:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-18", y: 11, id: "S5P-388292 (744b2)", platform: "S5P", start: "2025-05-18T04:00:00", stop: "2025-05-18T16:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-19", y: 12, id: "S1A-476203 (744b3)", platform: "S1A", start: "2025-05-19T00:30:00", stop: "2025-05-19T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-20", y: 13, id: "S2A-511983 (744b4)", platform: "S2A", start: "2025-05-20T01:40:00", stop: "2025-05-20T13:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-21", y: 14, id: "S2B-423383 (744b5)", platform: "S2B", start: "2025-05-21T02:30:00", stop: "2025-05-21T14:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-22", y: 12, id: "S3A-125037 (744b6)", platform: "S3A", start: "2025-05-22T03:40:00", stop: "2025-05-22T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-23", y: 14, id: "S3B-105278 (744b7)", platform: "S3B", start: "2025-05-23T01:00:00", stop: "2025-05-23T13:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-24", y: 11, id: "S5P-388293 (744b8)", platform: "S5P", start: "2025-05-24T02:20:00", stop: "2025-05-24T14:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-25", y: 13, id: "S1A-476204 (744b9)", platform: "S1A", start: "2025-05-25T03:10:00", stop: "2025-05-25T15:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-26", y: 12, id: "S2A-511984 (744ba)", platform: "S2A", start: "2025-05-26T01:00:00", stop: "2025-05-26T13:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-27", y: 13, id: "S2B-423384 (744bb)", platform: "S2B", start: "2025-05-27T04:30:00", stop: "2025-05-27T16:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-28", y: 12, id: "S3A-125038 (744bc)", platform: "S3A", start: "2025-05-28T02:40:00", stop: "2025-05-28T14:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-29", y: 11, id: "S3B-105279 (744bd)", platform: "S3B", start: "2025-05-29T03:20:00", stop: "2025-05-29T15:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-30", y: 14, id: "S5P-388294 (744be)", platform: "S5P", start: "2025-05-30T01:15:00", stop: "2025-05-30T13:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-05-31", y: 12, id: "S1A-476205 (744bf)", platform: "S1A", start: "2025-05-31T04:30:00", stop: "2025-05-31T16:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Jun",
        data: [
            { x: "2025-06-01", y: 14, id: "S1A-476200 (743d2)", platform: "S1A", start: "2025-06-01T00:15:00", stop: "2025-06-01T12:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-02", y: 11, id: "S2A-51198 (743d3)", platform: "S2A", start: "2025-06-02T01:30:00", stop: "2025-06-02T13:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-03", y: 12, id: "S2B-42338 (743d4)", platform: "S2B", start: "2025-06-03T02:00:00", stop: "2025-06-03T14:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-04", y: 13, id: "S3A-125034 (743d5)", platform: "S3A", start: "2025-06-04T03:20:00", stop: "2025-06-04T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-05", y: 11, id: "S3B-105275 (743d6)", platform: "S3B", start: "2025-06-05T04:30:00", stop: "2025-06-05T16:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-06", y: 13, id: "S5P-38829", platform: "S5P", start: "2025-06-06T05:45:00", stop: "2025-06-06T18:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-07", y: 13, id: "S1A-476201 (743d8)", platform: "S1A", start: "2025-06-07T00:30:00", stop: "2025-06-07T12:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-08", y: 14, id: "S2A-51199 (743d9)", platform: "S2A", start: "2025-06-08T01:40:00", stop: "2025-06-08T13:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-09", y: 11, id: "S2B-42339 (743da)", platform: "S2B", start: "2025-06-09T02:10:00", stop: "2025-06-09T14:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-10", y: 12, id: "S3A-125035 (743db)", platform: "S3A", start: "2025-06-10T03:30:00", stop: "2025-06-10T15:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-11", y: 12, id: "S3B-105276 (743dc)", platform: "S3B", start: "2025-06-11T04:10:00", stop: "2025-06-11T16:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-12", y: 13, id: "S5P-38830", platform: "S5P", start: "2025-06-12T05:25:00", stop: "2025-06-12T17:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-13", y: 13, id: "S1A-476202 (743de)", platform: "S1A", start: "2025-06-13T00:45:00", stop: "2025-06-13T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-14", y: 13, id: "S2A-51200 (743df)", platform: "S2A", start: "2025-06-14T01:00:00", stop: "2025-06-14T13:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-15", y: 14, id: "S2B-42340 (743e0)", platform: "S2B", start: "2025-06-15T02:30:00", stop: "2025-06-15T14:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-16", y: 11, id: "S3A-125036 (743e1)", platform: "S3A", start: "2025-06-16T03:40:00", stop: "2025-06-16T15:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-17", y: 12, id: "S3B-105277 (743e2)", platform: "S3B", start: "2025-06-17T04:00:00", stop: "2025-06-17T16:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-18", y: 12, id: "S5P-38831", platform: "S5P", start: "2025-06-18T05:00:00", stop: "2025-06-18T17:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-19", y: 14, id: "S1A-476203 (743e4)", platform: "S1A", start: "2025-06-19T00:30:00", stop: "2025-06-19T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-20", y: 11, id: "S2A-51201 (743e5)", platform: "S2A", start: "2025-06-20T01:45:00", stop: "2025-06-20T13:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-21", y: 12, id: "S2B-42341 (743e6)", platform: "S2B", start: "2025-06-21T02:30:00", stop: "2025-06-21T14:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-22", y: 13, id: "S3A-125037 (743e7)", platform: "S3A", start: "2025-06-22T03:20:00", stop: "2025-06-22T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-23", y: 12, id: "S3B-105278 (743e8)", platform: "S3B", start: "2025-06-23T04:00:00", stop: "2025-06-23T16:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-24", y: 11, id: "S5P-38832 (743e9)", platform: "S5P", start: "2025-06-24T05:30:00", stop: "2025-06-24T17:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-25", y: 12, id: "S1A-476204 (743ea)", platform: "S1A", start: "2025-06-25T00:15:00", stop: "2025-06-25T12:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-26", y: 12, id: "S2A-51202 (743eb)", platform: "S2A", start: "2025-06-26T01:40:00", stop: "2025-06-26T13:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-27", y: 13, id: "S2B-42342", platform: "S2B", start: "2025-06-27T02:30:00", stop: "2025-06-27T14:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-28", y: 11, id: "S3A-125038", platform: "S3A", start: "2025-06-28T03:00:00", stop: "2025-06-28T15:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-29", y: 12, id: "S3B-105279", platform: "S3B", start: "2025-06-29T04:40:00", stop: "2025-06-29T16:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-06-30", y: 14, id: "S5P-38833", platform: "S5P", start: "2025-06-30T00:30:00", stop: "2025-06-30T12:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Jul",
        data: [
            { x: "2025-07-01", y: 11, id: "S1A-476205 (743f0)", platform: "S1A", start: "2025-07-01T00:15:00", stop: "2025-07-01T12:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-02", y: 14, id: "S2A-51203 (743f1)", platform: "S2A", start: "2025-07-02T01:45:00", stop: "2025-07-02T13:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-03", y: 14, id: "S2B-42343 (743f2)", platform: "S2B", start: "2025-07-03T02:00:00", stop: "2025-07-03T14:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-04", y: 11, id: "S3A-125039 (743f3)", platform: "S3A", start: "2025-07-04T03:20:00", stop: "2025-07-04T15:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-05", y: 11, id: "S3B-105280 (743f4)", platform: "S3B", start: "2025-07-05T04:00:00", stop: "2025-07-05T16:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-06", y: 12, id: "S5P-38834", platform: "S5P", start: "2025-07-06T05:30:00", stop: "2025-07-06T17:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-07", y: 14, id: "S1A-476206 (743f6)", platform: "S1A", start: "2025-07-07T00:25:00", stop: "2025-07-07T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-08", y: 13, id: "S2A-51204 (743f7)", platform: "S2A", start: "2025-07-08T01:10:00", stop: "2025-07-08T13:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-09", y: 12, id: "S2B-42344 (743f8)", platform: "S2B", start: "2025-07-09T02:15:00", stop: "2025-07-09T14:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-10", y: 11, id: "S3A-125040 (743f9)", platform: "S3A", start: "2025-07-10T03:45:00", stop: "2025-07-10T15:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-11", y: 12, id: "S3B-105281 (743fa)", platform: "S3B", start: "2025-07-11T04:20:00", stop: "2025-07-11T16:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-12", y: 12, id: "S5P-38835", platform: "S5P", start: "2025-07-12T05:10:00", stop: "2025-07-12T17:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-13", y: 11, id: "S1A-476207 (743fc)", platform: "S1A", start: "2025-07-13T00:50:00", stop: "2025-07-13T12:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-14", y: 13, id: "S2A-51205 (743fd)", platform: "S2A", start: "2025-07-14T01:35:00", stop: "2025-07-14T13:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-15", y: 12, id: "S2B-42345 (743fe)", platform: "S2B", start: "2025-07-15T02:20:00", stop: "2025-07-15T14:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-16", y: 11, id: "S3A-125041 (743ff)", platform: "S3A", start: "2025-07-16T03:00:00", stop: "2025-07-16T15:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-17", y: 14, id: "S3B-105282 (74400)", platform: "S3B", start: "2025-07-17T04:10:00", stop: "2025-07-17T16:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-18", y: 14, id: "S5P-38836", platform: "S5P", start: "2025-07-18T05:00:00", stop: "2025-07-18T17:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-19", y: 11, id: "S1A-476208 (74402)", platform: "S1A", start: "2025-07-19T00:10:00", stop: "2025-07-19T12:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-20", y: 11, id: "S2A-51206 (74403)", platform: "S2A", start: "2025-07-20T01:55:00", stop: "2025-07-20T13:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-21", y: 12, id: "S2B-42346 (74404)", platform: "S2B", start: "2025-07-21T02:40:00", stop: "2025-07-21T14:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-22", y: 14, id: "S3A-125042 (74405)", platform: "S3A", start: "2025-07-22T03:15:00", stop: "2025-07-22T15:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-23", y: 13, id: "S3B-105283 (74406)", platform: "S3B", start: "2025-07-23T04:00:00", stop: "2025-07-23T16:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-24", y: 12, id: "S5P-38837", platform: "S5P", start: "2025-07-24T05:15:00", stop: "2025-07-24T17:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-25", y: 11, id: "S1A-476209 (74408)", platform: "S1A", start: "2025-07-25T00:30:00", stop: "2025-07-25T12:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-26", y: 12, id: "S2A-51207 (74409)", platform: "S2A", start: "2025-07-26T01:20:00", stop: "2025-07-26T13:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-27", y: 12, id: "S2B-42347 (7440a)", platform: "S2B", start: "2025-07-27T02:35:00", stop: "2025-07-27T14:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-28", y: 11, id: "S3A-125043 (7440b)", platform: "S3A", start: "2025-07-28T03:25:00", stop: "2025-07-28T15:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-29", y: 13, id: "S3B-105284 (7440c)", platform: "S3B", start: "2025-07-29T04:10:00", stop: "2025-07-29T16:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-30", y: 12, id: "S5P-38838", platform: "S5P", start: "2025-07-30T05:30:00", stop: "2025-07-30T17:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-07-31", y: 11, id: "S1A-476210 (7440e)", platform: "S1A", start: "2025-07-31T00:20:00", stop: "2025-07-31T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Aug",
        data: [
            { x: "2025-08-01", y: 11, id: "S2A-51321-1", platform: "S2A", start: "2025-08-01T00:30:00", stop: "2025-08-01T12:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-02", y: 12, id: "S2B-475621-2", platform: "S2B", start: "2025-08-02T01:15:00", stop: "2025-08-02T13:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-03", y: 13, id: "S2C-42321-3", platform: "S2C", start: "2025-08-03T02:00:00", stop: "2025-08-03T14:05:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-04", y: 14, id: "S3A_20250804123456110000", platform: "S3A", start: "2025-08-04T03:30:00", stop: "2025-08-04T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-05", y: 13, id: "S3B_20250805054523990011", platform: "S3B", start: "2025-08-05T04:10:00", stop: "2025-08-05T16:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-06", y: 12, id: "S5P-38921", platform: "S5P", start: "2025-08-06T05:25:00", stop: "2025-08-06T17:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-07", y: 11, id: "S2A-51322-2", platform: "S2A", start: "2025-08-07T00:45:00", stop: "2025-08-07T12:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-08", y: 14, id: "S2B-475622-3", platform: "S2B", start: "2025-08-08T01:30:00", stop: "2025-08-08T13:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-09", y: 12, id: "S2C-42322-4", platform: "S2C", start: "2025-08-09T02:10:00", stop: "2025-08-09T14:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-10", y: 13, id: "S3A_20250810111111002222", platform: "S3A", start: "2025-08-10T03:25:00", stop: "2025-08-10T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-11", y: 11, id: "S3B_20250811054523003333", platform: "S3B", start: "2025-08-11T04:30:00", stop: "2025-08-11T16:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-12", y: 14, id: "S5P-38922", platform: "S5P", start: "2025-08-12T05:40:00", stop: "2025-08-12T18:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-13", y: 12, id: "S2A-51323-3", platform: "S2A", start: "2025-08-13T00:50:00", stop: "2025-08-13T12:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-14", y: 13, id: "S2B-475623-4", platform: "S2B", start: "2025-08-14T01:35:00", stop: "2025-08-14T13:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-15", y: 11, id: "S2C-42323-5", platform: "S2C", start: "2025-08-15T02:00:00", stop: "2025-08-15T14:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-16", y: 14, id: "S3A_20250816144656004444", platform: "S3A", start: "2025-08-16T03:55:00", stop: "2025-08-16T16:05:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-17", y: 13, id: "S3B_20250817054523005555", platform: "S3B", start: "2025-08-17T04:20:00", stop: "2025-08-17T16:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-18", y: 11, id: "S5P-38923", platform: "S5P", start: "2025-08-18T05:50:00", stop: "2025-08-18T18:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-19", y: 12, id: "S2A-51324-4", platform: "S2A", start: "2025-08-19T00:40:00", stop: "2025-08-19T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-20", y: 13, id: "S2B-475624-5", platform: "S2B", start: "2025-08-20T01:25:00", stop: "2025-08-20T13:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-21", y: 14, id: "S2C-42324-6", platform: "S2C", start: "2025-08-21T02:00:00", stop: "2025-08-21T14:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-22", y: 11, id: "S3A_20250822123456997777", platform: "S3A", start: "2025-08-22T03:10:00", stop: "2025-08-22T15:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-23", y: 13, id: "S3B_20250823054523998888", platform: "S3B", start: "2025-08-23T04:15:00", stop: "2025-08-23T16:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-24", y: 14, id: "S5P-38924", platform: "S5P", start: "2025-08-24T05:30:00", stop: "2025-08-24T17:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-25", y: 12, id: "S2A-51325-5", platform: "S2A", start: "2025-08-25T00:35:00", stop: "2025-08-25T12:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-26", y: 11, id: "S2B-475625-6", platform: "S2B", start: "2025-08-26T01:25:00", stop: "2025-08-26T13:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-27", y: 14, id: "S2C-42325-7", platform: "S2C", start: "2025-08-27T02:10:00", stop: "2025-08-27T14:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-28", y: 13, id: "S3A_20250828111111009999", platform: "S3A", start: "2025-08-28T03:55:00", stop: "2025-08-28T16:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-29", y: 12, id: "S3B_20250829054523000000", platform: "S3B", start: "2025-08-29T04:25:00", stop: "2025-08-29T16:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-30", y: 11, id: "S5P-38925", platform: "S5P", start: "2025-08-30T05:40:00", stop: "2025-08-30T18:00:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-08-31", y: 13, id: "S1A-476200 (7445a)", platform: "S1A", start: "2025-08-31T00:50:00", stop: "2025-08-31T13:10:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Sep",
        data: [
            { x: "2025-09-01", y: 12, id: "S2A-62100-1", platform: "S2A", start: "2025-09-01T00:30:00", stop: "2025-09-01T12:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-02", y: 14, id: "S2B-598231-2", platform: "S2B", start: "2025-09-02T01:00:00", stop: "2025-09-02T13:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-03", y: 11, id: "S2C-558921-3", platform: "S2C", start: "2025-09-03T02:15:00", stop: "2025-09-03T14:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-04", y: 13, id: "S3A_20250904123456120000", platform: "S3A", start: "2025-09-04T03:20:00", stop: "2025-09-04T15:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-05", y: 12, id: "S3B_20250905054523990111", platform: "S3B", start: "2025-09-05T04:10:00", stop: "2025-09-05T16:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-06", y: 14, id: "S5P-40001", platform: "S5P", start: "2025-09-06T05:30:00", stop: "2025-09-06T17:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-07", y: 13, id: "S2A-62101-2", platform: "S2A", start: "2025-09-07T00:45:00", stop: "2025-09-07T12:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-08", y: 11, id: "S2B-598232-3", platform: "S2B", start: "2025-09-08T01:20:00", stop: "2025-09-08T13:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-09", y: 12, id: "S2C-558922-4", platform: "S2C", start: "2025-09-09T02:00:00", stop: "2025-09-09T14:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-10", y: 14, id: "S3A_20250910111111002333", platform: "S3A", start: "2025-09-10T03:00:00", stop: "2025-09-10T15:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-11", y: 13, id: "S3B_20250911054523003444", platform: "S3B", start: "2025-09-11T04:00:00", stop: "2025-09-11T16:35:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-12", y: 11, id: "S5P-40002", platform: "S5P", start: "2025-09-12T05:20:00", stop: "2025-09-12T17:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-13", y: 12, id: "S2A-62102-3", platform: "S2A", start: "2025-09-13T00:50:00", stop: "2025-09-13T12:55:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-14", y: 14, id: "S2B-598233-4", platform: "S2B", start: "2025-09-14T01:40:00", stop: "2025-09-14T13:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-15", y: 13, id: "S2C-558923-5", platform: "S2C", start: "2025-09-15T02:10:00", stop: "2025-09-15T14:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-16", y: 11, id: "S3A_20250916144656004555", platform: "S3A", start: "2025-09-16T03:10:00", stop: "2025-09-16T15:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-17", y: 12, id: "S3B_20250917054523005666", platform: "S3B", start: "2025-09-17T04:25:00", stop: "2025-09-17T16:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-18", y: 14, id: "S5P-40003", platform: "S5P", start: "2025-09-18T05:15:00", stop: "2025-09-18T17:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-19", y: 13, id: "S2A-62103-4", platform: "S2A", start: "2025-09-19T00:40:00", stop: "2025-09-19T12:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-20", y: 11, id: "S2B-598234-5", platform: "S2B", start: "2025-09-20T01:25:00", stop: "2025-09-20T13:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-21", y: 12, id: "S2C-558924-6", platform: "S2C", start: "2025-09-21T02:00:00", stop: "2025-09-21T14:15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-22", y: 14, id: "S3A_20250922123456998888", platform: "S3A", start: "2025-09-22T03:30:00", stop: "2025-09-22T15:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-23", y: 13, id: "S3B_20250923054523999999", platform: "S3B", start: "2025-09-23T04:05:00", stop: "2025-09-23T16:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-24", y: 11, id: "S5P-40004", platform: "S5P", start: "2025-09-24T05:00:00", stop: "2025-09-24T17:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-25", y: 12, id: "S2A-62104-5", platform: "S2A", start: "2025-09-25T00:55:00", stop: "2025-09-25T12:25:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-26", y: 14, id: "S2B-598235-6", platform: "S2B", start: "2025-09-26T01:30:00", stop: "2025-09-26T13:45:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-27", y: 13, id: "S2C-558925-7", platform: "S2C", start: "2025-09-27T02:00:00", stop: "2025-09-27T14:20:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-28", y: 11, id: "S3A_20250928111111001000", platform: "S3A", start: "2025-09-28T03:15:00", stop: "2025-09-28T15:30:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-29", y: 12, id: "S3B_20250929054523001111", platform: "S3B", start: "2025-09-29T04:30:00", stop: "2025-09-29T16:40:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-09-30", y: 14, id: "S5P-40005", platform: "S5P", start: "2025-09-30T05:30:00", stop: "2025-09-30T17:50:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Oct",
        data: [
            { "x": "2025-10-01", "y": 11, "id": "S2A-63000-1", platform: "S2A", start: "2025-10-01T01:43", stop: "2025-10-01T13:45", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-02", "y": 13, "id": "S2B-590321-2", platform: "S2B", start: "2025-10-02T02:30", stop: "2025-10-02T12:25", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-03", "y": 12, "id": "S2C-568921-3", platform: "S2C", start: "2025-10-03T03:15", stop: "2025-10-03T15:10", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-04", "y": 14, "id": "S3A_20251004123456130000", platform: "S3A", start: "2025-10-04T08:10", stop: "2025-10-04T08:27", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-05", "y": 11, "id": "S3B_20251005054523990222", platform: "S3B", start: "2025-10-05T07:21", stop: "2025-10-05T07:37", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-06", "y": 14, "id": "S5P-41001", platform: "S5P", start: "2025-10-06T05:00", stop: "2025-10-06T15:33", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-07", "y": 13, "id": "S2A-63001-2", platform: "S2A", start: "2025-10-07T02:40", stop: "2025-10-07T14:05", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-08", "y": 12, "id": "S2B-590322-3", platform: "S2B", start: "2025-10-08T01:20", stop: "2025-10-08T11:55", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-09", "y": 14, "id": "S2C-568922-4", platform: "S2C", start: "2025-10-09T03:33", stop: "2025-10-09T14:45", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-10", "y": 11, "id": "S3A_20251010111111002444", platform: "S3A", start: "2025-10-10T09:20", stop: "2025-10-10T09:35", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-11", "y": 13, "id": "S3B_20251011054523003555", platform: "S3B", start: "2025-10-11T07:03", stop: "2025-10-11T07:15", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-12", "y": 11, "id": "S5P-41002", platform: "S5P", start: "2025-10-12T06:10", stop: "2025-10-12T12:30", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-13", "y": 12, "id": "S2A-63002-3", platform: "S2A", start: "2025-10-13T04:20", stop: "2025-10-13T12:40", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-14", "y": 12, "id": "S2B-590323-4", platform: "S2B", start: "2025-10-14T00:45", stop: "2025-10-14T12:05", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-15", "y": 11, "id": "S2C-568923-5", platform: "S2C", start: "2025-10-15T05:10", stop: "2025-10-15T14:55", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-16", "y": 14, "id": "S3A_20251016144656004666", platform: "S3A", start: "2025-10-16T10:24", stop: "2025-10-16T10:36", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-17", "y": 13, "id": "S3B_20251017054523005777", platform: "S3B", start: "2025-10-17T01:10", stop: "2025-10-17T01:23", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-18", "y": 12, "id": "S5P-41003", platform: "S5P", start: "2025-10-18T03:39", stop: "2025-10-18T04:03", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-19", "y": 12, "id": "S2A-63003-4", platform: "S2A", start: "2025-10-19T06:11", stop: "2025-10-19T14:45", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-20", "y": 12, "id": "S2B-590324-5", platform: "S2B", start: "2025-10-20T05:40", stop: "2025-10-20T15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-21", "y": 11, "id": "S2C-568924-6", platform: "S2C", start: "2025-10-21T04:27", stop: "2025-10-21T14:12", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-22", "y": 14, "id": "S3A_20251022123456999999", platform: "S3A", start: "2025-10-22T07:10", stop: "2025-10-22T07:30", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-23", "y": 13, "id": "S3B_20251023054523001111", platform: "S3B", start: "2025-10-23T06:30", stop: "2025-10-23T06:50", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-24", "y": 13, "id": "S5P-41004", platform: "S5P", start: "2025-10-24T04:33", stop: "2025-10-24T15:11", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-25", "y": 12, "id": "S2A-63004-5", platform: "S2A", start: "2025-10-25T03:30", stop: "2025-10-25T14:12", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-26", "y": 14, "id": "S2B-590325-6", platform: "S2B", start: "2025-10-26T02:19", stop: "2025-10-26T12:40", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-27", "y": 11, "id": "S2C-568925-7", platform: "S2C", start: "2025-10-27T01:50", stop: "2025-10-27T13:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-28", "y": 13, "id": "S3A_20251028111111001222", platform: "S3A", start: "2025-10-28T10:10", stop: "2025-10-28T10:20", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-29", "y": 13, "id": "S3B_20251029054523001333", platform: "S3B", start: "2025-10-29T11:55", stop: "2025-10-29T12:05", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-30", "y": 13, "id": "S5P-41005", platform: "S5P", start: "2025-10-30T03:45", stop: "2025-10-30T14:05", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { "x": "2025-10-31", "y": 12, "id": "S1A-487300 (7555a)", platform: "S1A", start: "2025-10-31T02:30", stop: "2025-10-31T15:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Nov",
        data: [
            { x: "2025-11-01", y: 12, id: "S2A-64000-1", platform: "S2A", start: "2025-11-01T15:18:33", stop: "2025-11-01T02:51:17", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-02", y: 11, id: "S2B-600321-2", platform: "S2B", start: "2025-11-02T09:42:56", stop: "2025-11-02T21:34:49", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-03", y: 13, id: "S2C-578921-3", platform: "S2C", start: "2025-11-03T22:07:19", stop: "2025-11-03T10:08:23", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-04", y: 14, id: "S3A_20251104123456140000", platform: "S3A", start: "2025-11-04T05:31:42", stop: "2025-11-04T17:41:57", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-05", y: 12, id: "S3B_20251105054523990333", platform: "S3B", start: "2025-11-05T18:56:05", stop: "2025-11-05T04:15:31", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-06", y: 11, id: "S5P-42001", platform: "S5P", start: "2025-11-06T03:20:28", stop: "2025-11-06T15:28:44", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-07", y: 14, id: "S2A-64001-2", platform: "S2A", start: "2025-11-07T10:45:51", stop: "2025-11-07T23:02:10", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-08", y: 13, id: "S2B-600322-3", platform: "S2B", start: "2025-11-08T23:10:14", stop: "2025-11-08T11:35:36", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-09", y: 12, id: "S2C-578922-4", platform: "S2C", start: "2025-11-09T07:34:37", stop: "2025-11-09T19:48:59", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-10", y: 11, id: "S3A_20251110111111002555", platform: "S3A", start: "2025-11-10T16:59:00", stop: "2025-11-10T05:22:23", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-11", y: 14, id: "S3B_20251111054523003666", platform: "S3B", start: "2025-11-11T01:23:23", stop: "2025-11-11T13:55:42", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-12", y: 13, id: "S5P-42002", platform: "S5P", start: "2025-11-12T12:47:46", stop: "2025-11-12T00:09:06", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-13", y: 12, id: "S2A-64002-3", platform: "S2A", start: "2025-11-13T19:12:09", stop: "2025-11-13T07:32:29", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-14", y: 11, id: "S2B-600323-4", platform: "S2B", start: "2025-11-14T06:36:32", stop: "2025-11-14T18:05:55", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-15", y: 14, id: "S2C-578923-5", platform: "S2C", start: "2025-11-15T20:00:55", stop: "2025-11-15T09:29:13", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-16", y: 13, id: "S3A_20251116144656004777", platform: "S3A", start: "2025-11-16T04:25:18", stop: "2025-11-16T16:52:31", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-17", y: 12, id: "S3B_20251117054523005888", platform: "S3B", start: "2025-11-17T13:49:41", stop: "2025-11-17T01:16:49", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-18", y: 11, id: "S5P-42003", platform: "S5P", start: "2025-11-18T21:14:04", stop: "2025-11-18T07:40:07", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-19", y: 14, id: "S2A-64003-4", platform: "S2A", start: "2025-11-19T08:38:27", stop: "2025-11-19T20:13:26", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-20", y: 12, id: "S2B-600324-5", platform: "S2B", start: "2025-11-20T17:02:50", stop: "2025-11-20T03:46:53", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-21", y: 13, id: "S2C-578924-6", platform: "S2C", start: "2025-11-21T02:27:13", stop: "2025-11-21T14:59:59", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-22", y: 11, id: "S3A_20251122123456990000", platform: "S3A", start: "2025-11-22T11:51:36", stop: "2025-11-22T00:12:22", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-23", y: 14, id: "S3B_20251123054523001111", platform: "S3B", start: "2025-11-23T19:16:00", stop: "2025-11-23T06:35:46", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-24", y: 13, id: "S5P-42004", platform: "S5P", start: "2025-11-24T06:40:23", stop: "2025-11-24T18:08:50", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-25", y: 12, id: "S2A-64004-5", platform: "S2A", start: "2025-11-25T14:04:46", stop: "2025-11-25T03:31:33", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-26", y: 11, id: "S2B-600325-6", platform: "S2B", start: "2025-11-26T21:29:09", stop: "2025-11-26T09:54:56", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-27", y: 14, id: "S2C-578925-7", platform: "S2C", start: "2025-11-27T08:53:32", stop: "2025-11-27T20:27:19", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-28", y: 13, id: "S3A_20251128111111001333", platform: "S3A", start: "2025-11-28T17:17:55", stop: "2025-11-28T05:41:42", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-29", y: 12, id: "S3B_20251129054523001444", platform: "S3B", start: "2025-11-29T02:42:18", stop: "2025-11-29T15:04:59", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-11-30", y: 11, id: "S5P-42005", platform: "S5P", start: "2025-11-30T10:06:41", stop: "2025-11-30T22:38:26", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    },
    {
        name: "Dec",
        data: [
            { x: "2025-12-01", y: 13, id: "S2A-65000-1", platform: "S2A", start: "2025-12-01T18:29:47", stop: "2025-12-01T05:03:11", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-02", y: 11, id: "S2B-610321-2", platform: "S2B", start: "2025-12-02T03:54:30", stop: "2025-12-02T16:37:54", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-03", y: 12, id: "S2C-588921-3", platform: "S2C", start: "2025-12-03T11:19:13", stop: "2025-12-03T23:00:38", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-04", y: 14, id: "S3A_20251204123456150000", platform: "S3A", start: "2025-12-04T20:43:56", stop: "2025-12-04T07:41:21", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-05", y: 13, id: "S3B_20251205054523990444", platform: "S3B", start: "2025-12-05T06:08:39", stop: "2025-12-05T18:14:45", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-06", y: 12, id: "S5P-43001", platform: "S5P", start: "2025-12-06T15:33:22", stop: "2025-12-06T02:27:10", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-07", y: 14, id: "S2A-65001-2", platform: "S2A", start: "2025-12-07T00:58:05", stop: "2025-12-07T13:09:35", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-08", y: 11, id: "S2B-610322-3", platform: "S2B", start: "2025-12-08T09:22:48", stop: "2025-12-08T21:42:00", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-09", y: 12, id: "S2C-588922-4", platform: "S2C", start: "2025-12-09T18:47:31", stop: "2025-12-09T05:15:25", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-10", y: 13, id: "S3A_20251210111111002666", platform: "S3A", start: "2025-12-10T04:12:14", stop: "2025-12-10T16:58:49", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-11", y: 14, id: "S3B_20251211054523003777", platform: "S3B", start: "2025-12-11T13:36:57", stop: "2025-12-11T00:31:13", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-12", y: 11, id: "S5P-43002", platform: "S5P", start: "2025-12-12T22:01:40", stop: "2025-12-12T08:04:37", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-13", y: 12, id: "S2A-65002-3", platform: "S2A", start: "2025-12-13T07:26:23", stop: "2025-12-13T19:37:01", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-14", y: 14, id: "S2B-610323-4", platform: "S2B", start: "2025-12-14T16:51:06", stop: "2025-12-14T03:10:26", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-15", y: 13, id: "S2C-588923-5", platform: "S2C", start: "2025-12-15T02:15:49", stop: "2025-12-15T14:43:51", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-16", y: 12, id: "S3A_20251216144656004888", platform: "S3A", start: "2025-12-16T11:40:32", stop: "2025-12-16T22:17:16", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-17", y: 11, id: "S3B_20251217054523005999", platform: "S3B", start: "2025-12-17T21:05:15", stop: "2025-12-17T09:00:41", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-18", y: 14, id: "S5P-43003", platform: "S5P", start: "2025-12-18T06:30:00", stop: "2025-12-18T17:33:25", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-19", y: 12, id: "S2A-65003-4", platform: "S2A", start: "2025-12-19T15:54:43", stop: "2025-12-19T04:06:50", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-20", y: 11, id: "S2B-610324-5", platform: "S2B", start: "2025-12-20T01:19:26", stop: "2025-12-20T13:49:15", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-21", y: 14, id: "S2C-588924-6", platform: "S2C", start: "2025-12-21T10:44:09", stop: "2025-12-21T23:21:40", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-22", y: 13, id: "S3A_20251222123456991111", platform: "S3A", start: "2025-12-22T19:08:52", stop: "2025-12-22T06:54:05", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-23", y: 12, id: "S3B_20251223054523002222", platform: "S3B", start: "2025-12-23T04:33:35", stop: "2025-12-23T17:27:30", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-24", y: 11, id: "S5P-43004", platform: "S5P", start: "2025-12-24T13:58:18", stop: "2025-12-24T00:00:55", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-25", y: 14, id: "S2A-65004-5", platform: "S2A", start: "2025-12-25T23:23:01", stop: "2025-12-25T10:33:20", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-26", y: 13, id: "S2B-610325-6", platform: "S2B", start: "2025-12-26T08:47:44", stop: "2025-12-26T21:06:45", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-27", y: 12, id: "S2C-588925-7", platform: "S2C", start: "2025-12-27T18:12:27", stop: "2025-12-27T04:39:50", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-28", y: 11, id: "S3A_20251228111111001444", platform: "S3A", start: "2025-12-28T03:37:10", stop: "2025-12-28T15:52:15", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-29", y: 12, id: "S3B_20251229054523001555", platform: "S3B", start: "2025-12-29T12:01:53", stop: "2025-12-29T01:04:40", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-30", y: 14, id: "S5P-43005", platform: "S5P", start: "2025-12-30T21:26:36", stop: "2025-12-30T07:17:05", acquisition: "PLANNED", publication: "PLANNED (0.0%)" },
            { x: "2025-12-31", y: 13, id: "S1A-498300 (7666a)", platform: "S1A", start: "2025-12-31T06:51:19", stop: "2025-12-31T19:28:30", acquisition: "PLANNED", publication: "PLANNED (0.0%)" }
        ]
    }
];

const getColorForPercentage = (percentage) => {
    if (percentage <= 5) return '#FF6347';        // Unrecoverable
    if (percentage <= 10) return '#FFFF99';       // Partial Data Unrecoverable
    if (percentage <= 14) return '#71B5B8';        // Planned
    if (percentage <= 20) return '#FFD700';       // Partial Dataset Availability
    return '#0aa41b';                              // Full Data Availability
};

const publicationTypeColors = {
    "UNAVAILABLE": "#FF6347",
    "PARTIAL": "#FFFF99",
    "PLANNED": "#71B5B8",
    "PROCESSING": "#FFD700",
    "PUBLISHED": "#0aa41b",
    "DELAYED": "#ccc" // fallback color
};


class GlobalDatatakes {
    constructor(monthsData, formatDataDetail) {
        this.mockDataTakes = monthsData;
        this.formatDataDetail = formatDataDetail;
        this.currentPage = 1;
        this.rowsPerPage = 10;
        this.currentInfoPage = 1;
        this.itemsPerPage = 7;
        this.currentDataArray = [];
        this.donutChartInstance = null;
        this.resizeListenerAttached = false;


    }

    init() {
        document.addEventListener("DOMContentLoaded", () => {
            // Hide EC and Copernicus logos from header
            $('#copernicus-logo-header').hide();
            $('#ec-logo-header').hide();
            $('#esa-logo-header').hide();

            // Retrieve the user profile to determine quarter authorization
            ajaxCall(
                '/api/auth/quarter-authorized',
                'GET',
                {},
                this.quarterAuthorizedProcess,
                this.errorLoadAuthorized
            );

            // Retrieve the time select combo box instance
            const time_period_sel = document.getElementById('time-period-select');

            // Apply filtering on page load
            if (this.filterDatatakesOnPageLoad()) {
                // If filtered, set some UI state, like time period select
                const time_period_sel = document.getElementById('time-period-select');
                if (time_period_sel) time_period_sel.value = 'last-quarter';
            } else {
                // No search filter, load default data
                const time_period_sel = document.getElementById('time-period-select');
                if (time_period_sel) time_period_sel.value = 'week';
            }

            // Add event listener for user selection
            time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

            // Load datatakes for the selected period
            this.loadDatatakesInPeriod(time_period_sel.value);

            // Event listeners
            document.getElementById("mission-select").addEventListener("change", () => this.filterByMission());
            document.getElementById("search-input").addEventListener("input", (e) => this.updateSuggestions(e.target.value));
            document.getElementById("apply-filter-btn").addEventListener("click", () => this.filterChart());
            document.getElementById("reset-btn").addEventListener("click", () => this.resetHeatmapAndTable());

            // Close suggestions dropdown on outside click
            const suggestionsDropdown = document.getElementById("suggestions-container");
            document.addEventListener("click", (e) => {
                const searchWrapper = document.querySelector(".search-update");
                if (suggestionsDropdown && !searchWrapper?.contains(e.target)) {
                    suggestionsDropdown.style.display = "none";
                }
            });

            this.chartOptions.series = this.prepareHeatmapData(this.mockDataTakes);

            const chartElement = document.querySelector("#heatmap");
            this.chartInstance = new ApexCharts(chartElement, this.chartOptions);
            this.chartInstance.render();

            window.exportTableToCSV = this.exportTableToCSV.bind(this);
            window.handleSuggestionClick = this.handleSuggestionClick.bind(this);
            console.log("Datatakes initialized.");

        });
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }
        }
    }

    errorLoadAuthorized(response) {
        return;
    }

    filterDatatakesOnPageLoad() {
        var queryString = window.location.search;
        var urlParams = new URLSearchParams(queryString);
        var searchFilter = urlParams.get('search');
        if (searchFilter) {
            console.info('Accessing page with search filter: ' + searchFilter);
            // Filter the data by matching the 'id' containing searchFilter (case-insensitive)
            this.filteredDataTakes = this.mockDataTakes.filter(take =>
                take.id.toLowerCase().includes(searchFilter.toLowerCase())
            );

            // Populate data list with filtered results
            this.populateDataList(false);

            return true;
        } else {
            // No filter - reset filteredDataTakes so populate uses full list
            this.filteredDataTakes = null;
            return false;
        }
    }

    on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select')
        console.log("Time period changed to " + time_period_sel.value)
        this.loadDatatakesInPeriod(time_period_sel.value);
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length == 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }
        }
    }

    errorLoadAuthorized(response) {
        return;
    }

    loadDatatakesInPeriod(selected_time_period) {

        // Acknowledge the retrieval of events with impact on DTs
        console.info("Invoking events retrieval...");
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {},
            this.successLoadAnomalies.bind(this), this.errorLoadAnomalies);

        // Acknowledge the invocation of rest APIs
        console.info("Invoking Datatakes retrieval...");
        if (selected_time_period === 'day') {
            asyncAjaxCall('/api/worker/cds-datatakes/last-24h', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else if (selected_time_period === 'week') {
            asyncAjaxCall('/api/worker/cds-datatakes/last-7d', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else if (selected_time_period === 'month') {
            asyncAjaxCall('/api/worker/cds-datatakes/last-30d', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else if (selected_time_period === 'prev-quarter') {
            asyncAjaxCall('/api/worker/cds-datatakes/previous-quarter', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        } else {
            asyncAjaxCall('/api/worker/cds-datatakes/last-quarter', 'GET', {},
                this.successLoadDatatakes.bind(this), this.errorLoadDatatake);
        }

        return;
    }

    successLoadAnomalies(response) {

        // Loop over anomalies, and bind every impaired DT with an anomaly
        var rows = format_response(response);
        for (var i = 0; i < rows.length; ++i) {

            // Auxiliary variables
            var anomaly = rows[i];
            var datatakes_completeness = format_response(anomaly["datatakes_completeness"]);
            for (var index = 0; index < datatakes_completeness.length; ++index) {
                try {
                    for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'', '\"')))) {
                        var datatake_id = Object.values(value)[0];
                        var completeness = this.calcDatatakeCompleteness(Object.values(value));
                        if (completeness < this.completeness_threshold) {
                            this.datatakesEventsMap[datatake_id] = anomaly;
                        }
                    }
                } catch (ex) {
                    console.warn("Error ", ex);
                    console.warn('An error occurred, while parsing the product level count string: ' +
                        datatakes_completeness[index].replaceAll('\'', '\"'));
                }
            }
        }
        return;
    }

    errorLoadAnomalies(response) {
        console.error(response);
    }

    successLoadDatatakes(response) {
        const rows = format_response(response);
        console.info('Datatakes successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Prepare the datatake list
        const datatakes = [];

        for (const row of rows) {
            const element = row['_source'];

            // Build satellite unit name (e.g., "S1A (IW)")
            let sat_unit = element['satellite_unit'];
            if (sat_unit.includes('S1') || sat_unit.includes('S2')) {
                sat_unit += ` (${element['instrument_mode']})`;
            }

            // Generate the datatake key (convert S1A IDs if needed)
            let datatake_id = element['datatake_id'];
            if (sat_unit.includes('S1')) {
                datatake_id = this.overrideS1DatatakesId(datatake_id);
            }

            // Parse sensing time range
            const sensing_start = moment(element['observation_time_start'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();
            const sensing_stop = moment(element['observation_time_stop'], 'yyyy-MM-DDTHH:mm:ss.SSSZ').toDate();

            // Push to list 
            datatakes.push({
                id: datatake_id,
                satellite: sat_unit,
                start: sensing_start,
                stop: sensing_stop,
                completenessStatus: element['completeness_status'],
                raw: element
            });
        }

        // Save the processed datatakes to the instance variable used by populateDataList
        this.globaldatatakesarray = datatakes;

        // Reset pagination count before repopulating
        this.displayedCount = 0;

        // If at least one datatake exists, update title and render
        if (datatakes.length > 0) {
            console.log("datatakes lenght", datatakes.length);
        }

    }

    errorLoadDatatake(response) {
        console.error(response)
        return;
    }

    calcDatatakeCompleteness(dtCompleteness) {
        var completeness = 0;
        var count = 0;
        for (var i = 1; i < dtCompleteness.length; ++i) {
            count++;
            completeness += dtCompleteness[i];
        }
        return (completeness / count);
    }

    overrideS1DatatakesId(datatake_id) {
        let num = datatake_id.substring(4);
        let hexaNum = parseInt(num).toString(16);
        return (datatake_id + ' (' + hexaNum + ')');
    }


    prepareHeatmapData(data) {
        return data.map((monthData) => {
            return {
                name: monthData.name,
                data: monthData.data.map((entry) => ({
                    x: entry.x,  // Date
                    y: entry.y === 0 ? 1 : entry.y,  // Replace 0s with 1
                    id: entry.id  // Data take ID
                }))
            };
        });
    }

    chartOptions = {
        chart: {
            type: 'heatmap',
            height: '600px',
            width: '100%',
            toolbar: { show: false },
            events: {
                dataPointSelection: (event, chartContext, config) => {
                    const { seriesIndex, dataPointIndex } = config;
                    const point = monthsData[seriesIndex]?.data[dataPointIndex];
                    console.log("Clicked Point:", point);  // Debug log
                    if (point && point.id) {

                        this.renderPieChartForDate(point.x);
                    }
                }
            }
        },
        series: monthsData.map(month => ({
            name: month.name,
            data: month.data.map(item => ({
                x: item.x,
                y: item.y,
                id: item.id
            }))
        })),
        xaxis: {
            categories: Array.from({ length: 31 }, (_, i) => (i + 1).toString()), // Days of the month (1-31)
            labels: {
                style: {
                    fontSize: '12px',
                    fontWeight: 'bold',
                    colors: '#FFFFFF',
                    fontFamily: 'NotesEsa'
                }
            },
        },
        yaxis: {
            categories: [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ],
            labels: {
                offsetX: 5,
                style: {
                    fontSize: '12px',
                    fontWeight: 'bold',
                    colors: '#ffffff',
                    fontFamily: 'NotesEsa'

                }
            },
        },
        plotOptions: {
            heatmap: {
                colorScale: {
                    ranges: [
                        { from: 11, to: 14.1, name: 'PLANNED', color: '#007B7F' },
                        { from: 1, to: 5.1, name: 'UNRECOVERABLE', color: '#FF6347' },
                        { from: 6, to: 10.1, name: 'PARTIAL DATA UNRECOVERABLE', color: '#FFFF99' },
                        { from: 15, to: 20.1, name: 'PARTIAL DATASET AVAILABILITY', color: '#FFD700' },
                        { from: 21, to: 30.1, name: 'FULL DATA AVAILABILITY', color: '#0aa41b' }
                    ]
                },
                background: '#f7f7f7'
            }
        },
        dataLabels: {
            enabled: false
        },
        tooltip: {
            theme: 'dark'
        },
        states: {
            normal: {
                filter: {
                    type: 'none',
                    value: 0,
                }
            },
            hover: {
                filter: {
                    type: 'darken',
                    value: 0.5,
                }
            },
            active: {
                allowMultipleDataPointsSelection: false,
                filter: {
                    type: 'darken',
                    value: 0.8,
                }
            }
        }
    };

    filterByMission() {
        const selectedMission = document.getElementById("mission-select").value;

        const updatedChartData = this.mockDataTakes.map(monthData => {
            const filteredData = monthData.data.filter(entry =>
                selectedMission ? entry.id.substring(0, 2) === selectedMission : true
            );
            return {
                name: monthData.name,
                data: filteredData
            };
        });

        this.chartInstance.updateSeries(updatedChartData);

        const filteredRows = updatedChartData.flatMap(month =>
            month.data.map(entry => ({
                id: entry.id,
                platform: entry.platform,
                start: entry.start,
                stop: entry.stop,
                acquisition: entry.acquisition,
                publication: entry.publication
            }))
        );

        this.showTable(filteredRows);
    }

    updateSuggestions(inputValue) {
        if (!inputValue.trim()) {
            suggestionsContainer.style.display = "none";
            return;
        }

        const suggestionsContainer = document.getElementById("suggestions-container");
        suggestionsContainer.innerHTML = "";

        // Assuming monthsData now contains structured data
        const matches = monthsData.flatMap(month =>
            month.data.filter(item =>
                (item.id && item.id.toLowerCase().includes(inputValue.toLowerCase())) ||
                (item.platform && item.platform.toLowerCase().includes(inputValue.toLowerCase())) ||
                (item.startDate && item.startDate.toLowerCase().includes(inputValue.toLowerCase())) // Filtering by startDate if it's available
            )
        );

        if (matches.length === 0) {
            const note = document.createElement("div");
            note.className = "suggestion-item";
            note.textContent = "No matches found";
            suggestionsContainer.appendChild(note);
            suggestionsContainer.style.display = "block";
            return;
        }

        matches.forEach(item => {
            const suggestion = document.createElement("div");
            suggestion.className = "suggestion-item";
            suggestion.textContent = `${item.id} (${item.platform})`; // Show ID and platform in the suggestion
            suggestion.onclick = () => handleSuggestionClick(item.id);
            suggestionsContainer.appendChild(suggestion);
        });



        suggestionsContainer.style.display = "block";
    }

    showTable(filteredRows = monthsData.flatMap(month => month.data)) {
        const tableContainer = document.getElementById("table-container");
        const tableBody = document.querySelector("#basic-datatables-data-takes tbody");

        if (!tableBody) {
            console.warn("Table body not found. Skipping table rendering.");
            return;
        }

        filteredRows.forEach(row => {
            // Color logic for acquisition
            const acquisitionStatus = row.acquisition.toUpperCase();
            let acquisitionColor = "#818181"; // default
            if (acquisitionStatus.includes("ACQUIRED")) {
                acquisitionColor = "#0aa41b"; // green
            } else if (acquisitionStatus.includes("PLANNED") || acquisitionStatus.includes("PROCESSING")) {
                acquisitionColor = "#818181"; // grey
            } else if (acquisitionStatus.includes("UNAVAILABLE")) {
                acquisitionColor = "#FF0000"; // red
            } else if (acquisitionStatus.includes("PARTIAL")) {
                acquisitionColor = "#FFD700"; // yellow
            }

            // Color logic for publication
            const publicationStatus = row.publication.toUpperCase();
            let publicationColor = "#818181"; // default
            if (publicationStatus.includes("PUBLISHED")) {
                publicationColor = "#0aa41b"; // green
            } else if (publicationStatus.includes("PLANNED") || publicationStatus.includes("PROCESSING")) {
                publicationColor = "#818181"; // grey
            } else if (publicationStatus.includes("UNAVAILABLE")) {
                publicationColor = "#FF0000"; // red
            } else if (publicationStatus.includes("PARTIAL")) {
                publicationColor = "#FFD700"; // yellow
            }

            let tr = `<tr>
                      <td>${row.id}</td>
                      <td>${row.platform}</td>
                      <td>${row.start}</td>
                      <td>${row.stop}</td>
                      <td><span style="color:${acquisitionColor}">${row.acquisition}</span></td>
                      <td><span style="color:${publicationColor}">${row.publication}</span></td>
                      <td>
                          <button type="button" style="color: #8c90a0" class="btn-link" data-toggle="modal"
                              data-target="#showDatatakeDetailsModal"
                              onclick="datatakes.showDatatakeDetails('${row.id}')">
                              <i class="la flaticon-search-1"></i>
                          </button>
                      </td>
                    </tr>`;
            tableBody.innerHTML += tr;
        });

        tableContainer.style.display = 'block';
    }

    filterHeatmapChart(filteredIds) {
        const filteredSeries = monthsData.map((month) => {
            const filteredData = month.data.filter(entry => filteredIds.includes(entry.id));
            return {
                name: month.name,
                data: filteredData
            };
        });

        this.chartInstance.updateSeries(filteredSeries);
    }

    handleSuggestionClick(selectedId) {
        const input = document.getElementById("search-input");
        const suggestionsContainer = document.getElementById("suggestions-container");

        // Update the input with selected ID
        input.value = selectedId;


        // Hide the suggestions dropdown
        suggestionsContainer.innerHTML = "";
        suggestionsContainer.style.display = "none"; // <-- make sure it hides

        let selected = null;
        monthsData.forEach(month => {
            const entry = month.data.find(item => item.id === selectedId);
            if (entry) {
                selected = entry;
            }
        });

        if (!selected) return;

        // Trigger filtering logic
        this.filterHeatmapChart([selectedId]);

        // Highlight logic (optional)
        const date = new Date(selected.start);
        const selectedMonth = date.toLocaleString('default', { month: 'long' });
        const selectedDay = date.getDate();
        const monthData = monthsData.find(month => month.name.toLowerCase() === selectedMonth.toLowerCase());
        if (monthData) {
            const entry = monthData.data.find(entry => entry.x === selectedDay);
            if (entry) {
                console.log(`Highlight ${selectedMonth} ${selectedDay} on the heatmap`);
            }
        }
    }

    hideTable() {
        document.getElementById("table-container").style.display = "none";
    }

    resetHeatmapAndTable() {
        // Reset the search input field
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";

        // Clear the suggestions container
        const suggestionsContainer = document.getElementById("suggestions-container");
        if (suggestionsContainer) suggestionsContainer.innerHTML = "";

        // Reset the heatmap chart
        if (this.chartInstance) {
            this.chartInstance.updateSeries(this.prepareHeatmapData(monthsData));
        }

        // Hide the table container safely
        const tableContainer = document.getElementById("table-container");
        if (tableContainer) {
            tableContainer.style.display = "none";
        }

        // Reset the mission select dropdown
        const select = document.getElementById("mission-select");
        if (select) select.selectedIndex = 0;

        // Reset start and end date fields
        const startDate = document.getElementById("start-date");
        const endDate = document.getElementById("end-date");
        if (startDate) startDate.value = "";
        if (endDate) endDate.value = "";
    }

    generateSeries(startDate, endDate) {
        return monthsData.map(monthData => {
            const filteredData = monthData.data.filter(entry => {
                const entryDate = new Date(entry.x);
                return entryDate >= startDate && entryDate <= endDate;
            });

            return {
                name: monthData.name,
                data: filteredData.map(entry => ({
                    x: entry.x,
                    y: entry.y,
                    id: entry.id,
                    platform: entry.platform,
                    start: entry.start,
                    stop: entry.stop,
                    acquisition: entry.acquisition,
                    publication: entry.publication
                }))
            };
        });
    }

    filterChart() {
        if (!this.chartInstance) {
            console.error('Chart is not initialized yet!');
            return;
        }

        // Get selected dates
        const startDate = document.getElementById("start-date").value;
        const endDate = document.getElementById("end-date").value;

        if (!startDate || !endDate) {
            alert("Please select both start and end dates.");
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Filter chart
        const yValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        const filteredSeries = this.generateSeries(start, end, yValues);

        this.chartInstance.updateOptions({
            series: filteredSeries
        });

        // Filter table data from monthsData
        const filteredTableData = [];

        monthsData.forEach(month => {
            const filteredMonthData = month.data.filter(row => {
                const rowDate = new Date(row.start);
                return rowDate >= start && rowDate <= end;
            });

            if (filteredMonthData.length > 0) {
                filteredTableData.push(...filteredMonthData);
            }
        });

        const dataTable = document.getElementById("data-table");

        if (filteredTableData.length > 0) {
            if (dataTable) {
                dataTable.style.display = "block";  // Ensure the element exists before modifying the style
            }
        } else {
            if (dataTable) {
                dataTable.style.display = "none";  // Ensure the element exists before modifying the style
            }
        }
    }

    extractPercentage(publicationStr) {
        const match = publicationStr.match(/\(([\d.]+)%\)/);
        return match ? parseFloat(match[1]) : 0;
    }

    renderPieChartForDate(selectedDate) {
        const filtered = [];

        // Filter data for the selected date
        monthsData.forEach(month => {
            month.data.forEach(entry => {
                if (entry.x === selectedDate) {
                    filtered.push(entry);
                }
            });
        });

        const publicationMap = {};
        const idsMap = {};  // To store IDs based on publication type

        // Process the data and group by publication type, calculate average percentage, and store IDs
        filtered.forEach(entry => {
            const type = entry.publication?.split(" ")[0] || "UNKNOWN";
            const percentage = this.extractPercentage(entry.publication || "");

            if (!publicationMap[type]) {
                publicationMap[type] = { total: 0, count: 0 };
                idsMap[type] = [];  // Initialize ID array for this type
            }
            publicationMap[type].total += percentage;
            publicationMap[type].count += 1;
            idsMap[type].push(entry.id);  // Store the ID for this publication type
        });

        const series = [];
        const labels = [];

        // Calculate average percentage for each publication type
        const colors = [];

        for (const type in publicationMap) {
            const avg = publicationMap[type].total / publicationMap[type].count;
            const roundedAvg = parseFloat(avg.toFixed(2));

            series.push(roundedAvg);
            labels.push(type);

            const color = publicationTypeColors[type] || publicationTypeColors["UNKNOWN"];
            colors.push(color);
        }


        // Destroy the previous pie chart instance if it exists
        if (window.pieChartInstance) {
            window.pieChartInstance.destroy();
        }

        const options = {
            chart: {
                type: 'donut',
                height: 300,
                events: {
                    // Event when a donut segment is clicked
                    dataPointSelection: function (event, chartContext, config) {
                        console.log("Event fired");  // Check if the event is triggered

                        const selectedLabel = labels[config.dataPointIndex];
                        const selectedIDs = idsMap[selectedLabel] || [];


                        // Check if the idListContainer exists in the DOM
                        const idListContainer = document.getElementById("idListContainer");

                        // Log and display the container contents
                        if (idListContainer) {
                            console.log("idListContainer found. Populating list...");
                            idListContainer.innerHTML = `
                                <div class="custom-box-table-container">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4>Data Availability for "${selectedLabel}" on ${selectedDate}:</h4>
                    <button class="btn btn-sm btn-outline-primary" onclick="exportTableToCSV()">Export CSV</button>
                </div>
                <table id="idTable" class="table custom-box-table table-sm">
                    <thead>
                        <tr>
                            <th onclick="sortTable(0)">#</th>
                            <th onclick="sortTable(1)">Data Take ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedIDs.map((id, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${id}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
                            `;
                        } else {
                            console.error("idListContainer element is not found in the DOM");
                        }
                    }
                }
            },
            series: series,
            labels: labels,
            colors: colors,
            title: {
            },
            tooltip: {
                y: {
                    formatter: val => `${val.toFixed(2)}%`
                }
            }
        };

        // Create and render the pie chart
        window.pieChartInstance = new ApexCharts(document.querySelector("#pieChart"), options);
        window.pieChartInstance.render();
    }

    exportTableToCSV() {
        const table = document.getElementById("idTable");
        if (!table) {
            console.error("Table not found for export.");
            return;
        }

        let csv = [];
        const rows = table.querySelectorAll("tr");

        for (let row of rows) {
            const cols = row.querySelectorAll("th, td");
            let rowData = [];
            cols.forEach(col => {
                let text = col.textContent.trim().replace(/"/g, '""'); // Escape quotes
                rowData.push(`"${text}"`);
            });
            csv.push(rowData.join(","));
        }

        // Create a blob and trigger download
        const csvContent = csv.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "data_availability.csv");
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

}

window.globalDatatakes = new GlobalDatatakes(monthsData, formatDataDetail);
# Agent memory — index

Shared, Git-versioned memory for Codex and Claude Code (protocol: [`AGENTS.md` §0](../../AGENTS.md)).
Code and tests are the truth; these files record the verified state. Anything unverified is `UNKNOWN`.

| File | What it holds |
| --- | --- |
| [STATE.md](STATE.md) | Where the project stands now: what exists, what runs, what is verified. Read first. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Boundaries and structure (frontend part so far). Read before touching a boundary. |
| [DECISIONS.md](DECISIONS.md) | Significant decisions, with reasons. Add one before breaking a rule in AGENTS.md §3. |
| [HANDOFF.md](HANDOFF.md) | Incomplete work, known issues, pending backend fixes. Read when resuming. |

## Features

| Feature | State |
| --- | --- |
| [Processors page](features/processors.md) | `IMPLEMENTED` (desktop verified; mobile + tests open) |

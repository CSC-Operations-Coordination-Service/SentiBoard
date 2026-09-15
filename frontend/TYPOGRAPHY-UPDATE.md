# Typography: NotesEsa configuration

**Related:** DEVOCS-219 Frontend Restyling
**Applies to:** `frontend/` (Next.js). The Vite mock-ups under `design/react-mockups/` carry the
same arrangement through their own `@font-face` rules in `src/styles/global.css`.

## The rule

**NotesEsa is the ESA brand face and carries everything set in text** — headlines, body copy,
labels, buttons, navigation. There is no second text family.

The one exception is `--mono`, which stays a monospace stack. Identifiers, timestamps, orbit
numbers and percentages are read down a column, and a proportional face breaks that alignment.
Using NotesEsa there would be a regression, not more brand consistency.

## Configuration

| Role | Variable | Resolves to |
| --- | --- | --- |
| Body and UI | `--sans` | `var(--font-display)` → NotesEsa, system stack behind it |
| Headlines, brand | `--display` | `var(--font-display)` → NotesEsa, system stack behind it |
| Identifiers, timestamps, figures | `--mono` | `ui-monospace, "SF Mono", Menlo, Consolas, …` |

Both text variables point at the same family on purpose: one face, two roles, so a heading and a
paragraph can never drift onto different fonts.

### Loading

`app/layout.tsx` loads all four faces through `next/font/local`:

```tsx
const notesEsa = localFont({
  src: [
    { path: "./fonts/NotesEsa.woff2",           weight: "400", style: "normal" },
    { path: "./fonts/NotesEsa-Italic.woff2",     weight: "400", style: "italic" },
    { path: "./fonts/NotesEsa-Bold.woff2",       weight: "700", style: "normal" },
    { path: "./fonts/NotesEsa-BoldItalic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});
```

**Local, not `next/font/google`.** The Google loader downloads font files at build time over
undici, which ignores `HTTP_PROXY`/`HTTPS_PROXY`. On the proxied build host that hangs or fails.
The committed woff2 files let `next build` run with no network at all.

### The one trap

**Always reach the family through `var(--font-display)`. Never write `NotesEsa` literally in CSS.**

`next/font` rewrites the family to a hashed name. The compiled stylesheet contains:

```css
--font-display:"__notesEsa_22fde7","__notesEsa_Fallback_22fde7"
```

A literal `font-family: NotesEsa` matches no registered family, produces no warning, and falls
straight through to the system stack. An earlier revision of `globals.css` did exactly that, which
is why the brand face was not rendering anywhere in the app despite being loaded correctly.

## Font files

### Text — `app/fonts/`

| File | Weight | Style | Size |
| --- | --- | --- | --- |
| `NotesEsa.woff2` | 400 | normal | 20 KB |
| `NotesEsa-Italic.woff2` | 400 | italic | 23 KB |
| `NotesEsa-Bold.woff2` | 700 | normal | 20 KB |
| `NotesEsa-BoldItalic.woff2` | 700 | italic | 23 KB |

Removed in the same change: `inter-latin-var.woff2` (48 KB) and `space-grotesk-latin-var.woff2`
(22 KB).

### Icons — `public/assets/`

Declared in `globals.css` with `font-display: block`, so a glyph never flashes as a fallback
character:

| Family | File(s) | Used by |
| --- | --- | --- |
| `FA5Solid` | `fa-solid-900.woff2` (78 KB) | `.faico` glyphs |
| `Flaticon` | `Flaticon.woff` (34 KB) | ported `/v1` page glyphs |
| `Simple-Line-Icons` | `Simple-Line-Icons.woff2` (30 KB), `.woff` (81 KB) | ported `/v1` page glyphs |

These are functional glyph sets, not typography — the NotesEsa rule does not apply to them.

## Verifying a change

Font problems are silent by nature: the wrong family renders as *something*, so the page looks
fine at a glance. Check the compiled CSS rather than the source:

```bash
cd frontend && npx next build
grep -ho -- "--sans:[^;]*;\|--font-display:[^;]*" .next/static/css/*.css | sort -u
```

`--font-display` must show a `__notesEsa_<hash>` family, and `--sans` must reference
`var(--font-display)`. If `--sans` names a font literally, the brand face is not being applied.

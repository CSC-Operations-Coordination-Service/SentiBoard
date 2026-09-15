# Typography changelog

Change record for the DEVOCS-219 type work in `frontend/`. How the configuration works and how to
verify it are in [TYPOGRAPHY-UPDATE.md](./TYPOGRAPHY-UPDATE.md); this file only records what
changed and when.

---

## 2026-09-15 — NotesEsa everywhere, and the family name fix

**Body text now uses NotesEsa.** `--sans` previously resolved to a bare system stack, so the brand
face was limited to headings by design. Both `--sans` and `--display` now resolve to
`var(--font-display)`.

**Fixed: the brand face was not rendering at all.** `globals.css` declared
`--display: NotesEsa, …` as a literal family name. `next/font` rewrites the family to a hashed
name (`__notesEsa_22fde7`), so the literal matched nothing and every heading silently fell through
to `-apple-system`. Both variables now go through `var(--font-display)`.

This failure mode is invisible — the page still renders, in the fallback face — so the check in
TYPOGRAPHY-UPDATE.md reads the compiled CSS rather than the source.

**`--mono` unchanged**, deliberately: identifiers, timestamps and figures are read down a column,
and a proportional face breaks the alignment.

Files: `app/globals.css`, `app/layout.tsx`.

---

## 2026-09-14 — NotesEsa replaces Inter and Space Grotesk

Space Grotesk (display) and Inter (body) removed; NotesEsa added in four faces — regular, italic,
bold, bold-italic — loaded via `next/font/local` from `app/fonts/`.

Local rather than `next/font/google`: the Google loader fetches font files at build time over
undici, which ignores `HTTP_PROXY`/`HTTPS_PROXY` and hangs on the proxied build host. The
committed woff2 files let `next build` run with no network.

| | Removed | Added |
| --- | --- | --- |
| Files | `inter-latin-var.woff2`, `space-grotesk-latin-var.woff2` | 4 × `NotesEsa*.woff2` |
| Bytes | 70 KB | 87 KB |

Icon fonts `Flaticon` and `Simple-Line-Icons` added under `public/assets/` alongside the existing
`FA5Solid`, so the ported `/v1` pages render their glyphs offline.

Files: `app/layout.tsx`, `app/globals.css`, `app/fonts/`, `public/assets/`.

---

## Correction note — where "Lato" came from

Revisions of this file dated 2026-09-14 described a **Lato** body font loaded from Google Fonts,
justified as matching the current SentiBoard installation. That was a misreading, and no such
configuration was ever committed to this app.

The legacy Flask app does ask for Lato everywhere — it uses the Atlantis theme, whose stylesheet
sets `font-family: 'Lato', sans-serif` on the body. But `apps/static/assets/fonts/esa/esa.css`
overrides what that name resolves to:

```css
@font-face {
    font-display: block;
    font-family: "Lato";
    src: url('./notesesareg-webfont.woff') format('woff2'),
         url('./notesesabol-webfont.woff') format('woff');
}
```

The family is *named* Lato and *is* NotesEsa. Production has been rendering the brand face
everywhere all along; only the alias says otherwise. So "NotesEsa everywhere" is not a departure
from the installation — it is the same result, reached without the misleading alias, and without
fetching a real Lato from Google Fonts (which would break the proxied build for the reason given
above).

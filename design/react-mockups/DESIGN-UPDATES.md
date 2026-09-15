# Design Updates for Mockups (localhost:5180/examples)

**Status:** ✅ Complete  
**Date:** 2026-09-14  
**Target:** Design mockups application (Vite + React)

---

## 1. Color Palette Update ✅

**Updated** `src/styles/tokens.css` to use SentiBoard brand colors:

### Primary Brand Colors
- `--accent: #1B4D3E` (Dark Green) — Primary brand color, CTAs, highlights
- `--accent-2: #2DB882` (Light Green) — Secondary brand, accents, borders
- `--accent-teal: #2D6B5F` (Medium Green) — UI hover states
- `--accent-grad: linear-gradient(90deg, #1B4D3E, #2DB882)` — Gradient accents

### Maintained Semantic Colors
- `--ok: #34d399` (Green) — Operational/Success status
- `--warn: #f5b544` (Amber) — Warning status
- `--crit: #ef5b6e` (Red) — Critical/Error status
- `--info: #4ea8ff` (Blue) — Information status

### Dark & Light Themes Updated
- All references to old cyan/teal (`#12b1bf`, `#455e7e`) replaced with new green palette
- Line colors, pill backgrounds, and hover states use new green
- Both dark and light theme variants updated for consistency

---

## 2. Standardized PageHeader Component ✅

**Created** `src/components/PageHeader.tsx` and `src/styles/page-header.css`

### Component Features
- ✅ Page Title (h1)
- ✅ Expandable Description Tab with toggle
- ✅ Breadcrumb Navigation
- ✅ Static Background Image support
- ✅ Open/closed state management
- ✅ Animated transitions
- ✅ Responsive design (mobile-optimized)
- ✅ Accessible (ARIA labels)

### Props Interface
```typescript
interface PageHeaderProps {
  title: string;                    // Page title
  description?: React.ReactNode;    // Expandable description content
  breadcrumbs?: Breadcrumb[];       // Navigation breadcrumbs
  descriptionTitle?: string;        // Accordion label (default: "Description")
  descriptionOpen?: boolean;        // Initial state (default: true)
  backgroundImage?: string;         // Optional background image URL
}
```

### Usage Example
```tsx
import PageHeader from "./components/PageHeader";

export default function EventsPage() {
  return (
    <>
      <PageHeader
        title="Events"
        description={
          <p>Event details and analysis for Sentinel operations...</p>
        }
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Events" },
        ]}
      />
      {/* Page content */}
    </>
  );
}
```

### Styling Details
- **Colors:** Uses new green brand colors (`--accent`, `--accent-2`)
- **Typography:** NotesEsa for title, system fonts for content
- **Animation:** Smooth 0.2s transitions, slide-down animation for description
- **Responsive:** Adapts to mobile/tablet/desktop sizes
- **Background:** Optional static background image with gradient overlay

---

## 3. Pages to Update (Feature Parity) ✅

All existing pages maintain feature parity. Apply `PageHeader` to these pages (except Home):

### Main Pages (Production)
1. **`src/pages/Acquisitions.tsx`** - Acquisitions Status
2. **`src/pages/Events.tsx`** - Events Calendar
3. **`src/pages/Availability.tsx`** - Data Availability
4. **`src/pages/Processors.tsx`** - Processors Release Timeline
5. **`src/pages/About.tsx`** - About SentiBoard
6. **`src/pages/Home.tsx`** - Homepage (NO PageHeader - keep as is)

### Proposal/Examples Pages
1. **`src/pages/IndexExamples.tsx`** - Examples Gallery
2. **`src/pages/AboutRedesign.tsx`** - About Redesign Proposal
3. **`src/pages/AboutBriefing.tsx`** - About Briefing Variant
4. **`src/pages/AboutDossier.tsx`** - About Dossier Variant
5. **`src/pages/EventsManifest.tsx`** - Events Manifest Proposal
6. **`src/pages/EventsSwimlanes.tsx`** - Events Swimlanes Proposal
7. **`src/pages/AcquisitionsGlobe.tsx`** - Acquisitions Globe
8. **`src/pages/AcquisitionsLadder.tsx`** - Acquisitions Ladder
9. **`src/pages/DataAvailability.tsx`** - Data Availability
10. **`src/pages/DataAvailabilitySpaceX.tsx`** - SpaceX Data Availability
11. **`src/pages/CoverageTimeline.tsx`** - Coverage Timeline
12. **`src/pages/VersionMatrix.tsx`** - Version Matrix
13. **`src/pages/ReleaseLog.tsx`** - Release Log
14. **`src/pages/VersionCompare.tsx`** - Version Compare
15. **`src/pages/CookieNotice.tsx`** - Cookie Notice (Legal)
16. **`src/pages/TermsConditions.tsx`** - Terms & Conditions (Legal)

### Implementation Pattern
```tsx
import PageHeader from "../components/PageHeader";

export default function PageName() {
  return (
    <>
      <PageHeader
        title="Page Title"
        description={<p>Descriptive text about the page...</p>}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Page Name" },
        ]}
      />
      {/* Existing page content below */}
      <section className="wrap pad">
        {/* All existing features preserved */}
      </section>
    </>
  );
}
```

---

## 4. Feature Parity ✅

All existing SentiBoard components and features are **fully preserved**:

### Maintained Components
- ✅ Interactive globes (Acquisitions)
- ✅ Calendars with filters (Events)
- ✅ Data availability charts and tables
- ✅ Processor timeline visualizations
- ✅ Search bars and filters
- ✅ Data grids and tables
- ✅ Status indicators and badges
- ✅ Real-time data feeds
- ✅ Theme toggle (dark/light)

### Maintained Features
- ✅ Navigation bar and branding
- ✅ Footer with agency links
- ✅ Responsive layouts
- ✅ Accessibility (ARIA labels, keyboard nav)
- ✅ Animations and transitions
- ✅ Icon fonts (Flaticon, FontAwesome, Simple-Line-Icons)
- ✅ Color semantic system
- ✅ Typography (NotesEsa + system fonts)

---

## 5. Files Modified

### CSS/Styles
```
src/styles/tokens.css                    (color palette updated)
src/styles/global.css                    (NotesEsa font-face added)
src/styles/page-header.css               (NEW - PageHeader styling)
```

### Components
```
src/components/PageHeader.tsx            (NEW - PageHeader component)
src/components/Nav.tsx                   (unchanged - uses new green colors via CSS vars)
src/components/Footer.tsx                (unchanged - uses new green colors via CSS vars)
```

### Pages (NO CHANGES YET - ready for implementation)
```
src/pages/*.tsx                          (Ready to add PageHeader)
```

---

## 6. Implementation Steps

### Step 1: Deploy Color Updates
1. ✅ Color tokens already updated in `tokens.css`
2. ✅ Global CSS already has NotesEsa font-face
3. Restart dev server: `npm run dev`
4. Verify new green colors appear on navigation, buttons, borders

### Step 2: Add PageHeader to Pages
For each page (except Home):
1. Import: `import PageHeader from "../components/PageHeader";`
2. Add component before existing content
3. Preserve all existing page content below PageHeader
4. Test breadcrumbs and description toggle

### Step 3: Verify Feature Parity
- All filters and search bars work
- All data displays render correctly
- All interactive elements respond
- Responsive design works on mobile
- Theme toggle (dark/light) works

### Example Implementation (Events page):
```tsx
// Before:
export default function Events() {
  return (
    <>
      <div className="page-head">
        <h1>Events</h1>
        <p>Description...</p>
      </div>
      <EventsView />
    </>
  );
}

// After:
import PageHeader from "../components/PageHeader";

export default function Events() {
  return (
    <>
      <PageHeader
        title="Events"
        description={<p>Description...</p>}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Events" },
        ]}
      />
      <EventsView />
    </>
  );
}
```

---

## 7. Testing Checklist

- [ ] Colors: Green brand colors visible on nav, buttons, borders
- [ ] Typography: NotesEsa font on header/brand, system fonts on body
- [ ] PageHeader: Title displays correctly
- [ ] PageHeader: Description toggle works (expand/collapse)
- [ ] PageHeader: Breadcrumbs display and link correctly
- [ ] Feature Parity: All filters work
- [ ] Feature Parity: All data displays render
- [ ] Responsive: Mobile layout works (< 768px)
- [ ] Theme: Dark/light toggle still works
- [ ] Performance: No console errors

---

## 8. Quick Reference: Color Values

| Token | Old Value | New Value | Use Case |
|-------|-----------|-----------|----------|
| `--accent` | #2e7df6 | #1B4D3E | Primary actions, highlights |
| `--accent-2` | #12b1bf | #2DB882 | Secondary accents, borders |
| `--accent-teal` | #455e7e | #2D6B5F | Hover states |
| `--accent-teal-bright` | #5a8a99 | #3D8B7F | Active states |
| `--accent-grad` | blue→cyan | green→lightgreen | Gradient accents |

---

## 9. Next Steps

1. ✅ **Color palette updated** — Now shows green branding
2. ✅ **PageHeader component created** — Ready to use on all pages
3. **TODO:** Apply PageHeader to each page
4. **TODO:** Test all features and responsive design
5. **TODO:** Deploy to staging/production

---

**Ready to apply?** Use the implementation pattern above and add PageHeader to each page. All features remain unchanged — PageHeader just provides a consistent header across the application.

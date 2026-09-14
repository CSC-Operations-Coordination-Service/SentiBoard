# Theme-Aware Globe Implementation

## Summary
Added theme-aware color support to the acquisition globe visualization, allowing it to adapt to the user's system color scheme preference (dark/light mode).

## Changes Made

### 1. Theme Detection State (`AcquisitionGlobe.tsx:499`)
- Added `isDark` state that initializes based on `prefers-color-scheme: dark` media query
- Defaults to `true` if media query is unavailable

### 2. Theme Change Listener (`AcquisitionGlobe.tsx:555-557`)
- Added media query listener for `(prefers-color-scheme: dark)`
- Updates `isDark` state when user switches theme

### 3. Updated `drawBase()` Function (`AcquisitionGlobe.tsx:722-740`)
Created theme-aware color palettes for the globe visualization:

**Dark Mode (current defaults):**
- Sphere: Deep blues (#14233d → #0c1729 → #070d18)
- Atmosphere: Cyan-tinted glow
- Graticule: Cyan equator, muted meridians
- Coastlines: Soft blues and teals
- Station coverage: Cyan circles

**Light Mode (new):**
- Sphere: Light blues (#e8f2f9 → #f0f6fb → #f5f9fc)
- Atmosphere: Lighter blue glow
- Graticule: Blue equator, subtle slate meridians
- Coastlines: Slate and slate-dark
- Station coverage: Blue circles

### 4. Updated `draw()` Function (`AcquisitionGlobe.tsx:850-855`)
Theme-aware colors for interactive elements:
- Limb circle outline
- Station markers (live/idle)
- Station labels
- Datatake labels
- Label shadows

### 5. Cache Invalidation (`AcquisitionGlobe.tsx:791`)
- Added `isDark` to the `viewKey` so the base layer (coastlines, graticule, sphere) re-renders when theme changes
- Ensures smooth transitions between dark and light modes

### 6. Event Cleanup (`AcquisitionGlobe.tsx:1083`)
- Added cleanup for theme change listener to prevent memory leaks

## Testing

The implementation can be tested by:

1. **Accessing the globe:** Navigate to `/examples/acquisitions-globe` on the mockups app
2. **Switching system theme:** Use OS settings or browser dev tools to toggle color scheme
3. **Expected behavior:** 
   - Globe colors immediately adapt to the new theme
   - Light mode shows lighter sphere with better contrast on light backgrounds
   - Dark mode shows the original deep blue tones
   - All interactive elements (stations, footprints, labels) adapt automatically

## Performance Impact

- **Zero runtime cost:** Colors are selected based on the `isDark` boolean; no additional computation per frame
- **Minimal bundle size:** Only added state variables and conditional color assignments
- **Smart caching:** Base layer automatically invalidates when theme changes due to viewKey update

## Design Rationale

- **System preference detection:** Uses standard `prefers-color-scheme` media query for accessibility
- **Live switching:** Theme changes are detected in real-time without page reload
- **Light mode colors:** Chosen to maintain readability and visual hierarchy while fitting light backgrounds
- **Consistent with existing approach:** Follows the same demand-driven rendering pattern as the rest of the globe

## Files Modified

- `design/react-mockups/src/components/AcquisitionGlobe.tsx`

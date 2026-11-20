import { useCallback, useSyncExternalStore } from "react";

/** SSR-safe wrapper around window.matchMedia.
 *  Returns false on the server and during hydration; switches to the live
 *  match result once JS is running and stays in sync via the MQL change event. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True only on devices that support hover (mouse / trackpad).
 *  False on touch-primary devices where the browser emulates mouse events. */
export function useHoverCapable(): boolean {
  return useMediaQuery("(hover: hover)");
}

/* Runs one resource call for a component: loading → ready | error, with a retry. The request is
   aborted when the component unmounts or retries, so a stale answer never lands. */

import { useCallback, useEffect, useState } from "react";

export type ApiState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: unknown };

export function useApi<T>(
  load: (init: { signal: AbortSignal }) => Promise<T>,
): ApiState<T> & { retry: () => void } {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading" });
    load({ signal: ctrl.signal }).then(
      (data) => !ctrl.signal.aborted && setState({ status: "ready", data }),
      (error) => !ctrl.signal.aborted && setState({ status: "error", error }),
    );
    return () => ctrl.abort();
    // `load` is a module-level function; re-running is driven by `attempt` alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

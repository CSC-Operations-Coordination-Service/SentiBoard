export type ParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

export function reader(src: ParamSource): (name: string) => string | null {
  if (typeof (src as URLSearchParams).get === "function") {
    return (name) => (src as URLSearchParams).get(name);
  }
  return (name) => {
    const v = (src as Record<string, string | string[] | undefined>)[name];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
}

export function parseOffSet<T extends string>(
  raw: string | null,
  validate: (v: string) => v is T,
): Set<T> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is T => validate(s)),
  );
}

import type { NewsStatusKind } from "@/lib/data";

// Status badge shown on each news item — icon + label, coloured per status,
// mirroring prod's Instant-Message states (new / resolved / disaster).
const META: Record<NewsStatusKind, { label: string; icon: JSX.Element }> = {
  new: {
    label: "New",
    // filled circle with "!"
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M12 7v6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.15" fill="#fff" />
      </svg>
    ),
  },
  resolved: {
    label: "Resolved",
    // filled circle with check
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  disaster: {
    label: "Disaster",
    // filled triangle with "!"
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l9.5 16.5H2.5z" fill="currentColor" />
        <path d="M12 9.5v4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.1" fill="#fff" />
      </svg>
    ),
  },
};

export default function NewsStatus({ status }: { status: NewsStatusKind }) {
  const m = META[status];
  // Icon only — the label is used as the accessible tooltip/title.
  return (
    <span className={"nstatus " + status} title={m.label} aria-label={m.label} role="img">
      {m.icon}
    </span>
  );
}

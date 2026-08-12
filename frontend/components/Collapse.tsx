// The slide shared by every accordion in the app: the page "Description" panel and the occurrence
// rows in the Events drawer.
//
// Animating to `height:auto` is not possible, and a max-height guess is worse than it looks — too
// small silently clips the longest description, too large spends most of the transition animating
// empty space, so the close reads as a stall. A grid whose single row goes 0fr → 1fr resolves to
// the content's own height, so one rule animates panels of any length correctly.
//
// No state and no hooks, so this stays a server component and can be dropped into either a server
// page or a client one. The caller owns the open flag.
export default function Collapse({
  open,
  id,
  children,
}: {
  open: boolean;
  /** Target of the trigger's aria-controls. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`collapsible${open ? " open" : ""}`} id={id}>
      {/* The overflow clip has to sit on a child: it is the grid *item* that gets squeezed to
          zero, and clipping on the grid itself would leave the item overflowing it. */}
      <div className="collapsible-inner">{children}</div>
    </div>
  );
}

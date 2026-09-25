import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MilestonePlaceholder({
  milestone,
  title,
  bullets,
}: {
  milestone: string;
  title: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 shadow-[var(--shadow-panel)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{milestone}</p>
      <h2 className="mt-2 font-display text-lg font-semibold">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            {b}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted-foreground">
        Nothing here is simulated — this section stays empty until the milestone that builds it is
        implemented.
      </p>
    </div>
  );
}

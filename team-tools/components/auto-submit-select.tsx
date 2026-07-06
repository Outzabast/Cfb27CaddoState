"use client";

import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * A native <select> that submits its enclosing form as soon as the value
 * changes. Native (rather than the shadcn Select) so it participates in the
 * server-action FormData submit with zero extra wiring.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue: string;
  options: Option[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={cn(
        "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

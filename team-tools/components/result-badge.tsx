import { Badge } from "@/components/ui/badge";

/** W/L/T pill in team colors: W = navy, T = gold, L = muted. */
export function ResultBadge({
  r,
  score,
}: {
  r: "W" | "L" | "T";
  score?: string;
}) {
  const cls =
    r === "W"
      ? "bg-primary text-primary-foreground"
      : r === "T"
        ? "bg-[var(--brand-gold)] text-primary"
        : "bg-secondary text-secondary-foreground";
  return (
    <Badge className={`${cls} rounded-sm tabular-nums`}>
      {r}
      {score ? ` ${score}` : ""}
    </Badge>
  );
}

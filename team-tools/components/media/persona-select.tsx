"use client";

export type PersonaOption = { id: number; name: string };

/**
 * Checkboxes for which author personas should write — one piece each. The first
 * is checked by default so there's always a byline; uncheck all for the default
 * voice. Emits repeated `mediaPersonaId` fields.
 */
export function PersonaSelect({ personas }: { personas: PersonaOption[] }) {
  if (personas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No personas yet — the default voice will be used. Add personas in settings.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {personas.map((p, i) => (
        <label key={p.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mediaPersonaId" value={p.id} defaultChecked={i === 0} />
          {p.name}
        </label>
      ))}
    </div>
  );
}

import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { ModelPicker } from "@/components/media/model-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
  DEFAULT_MEDIA_MODEL,
  DEFAULT_AUDIO_MODEL,
  AUDIO_VOICES,
  DEFAULT_TTS_VOICE,
} from "@/lib/media/constants";
import { fetchOpenRouterModels, type OpenRouterModel } from "@/lib/media/models";
import { PersonaModelSelect } from "@/components/media/persona-model-select";
import { createPersona, updatePersona, deletePersona } from "./actions";

export const dynamic = "force-dynamic";

const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function MediaSettingsPage() {
  const [settings, personas] = await Promise.all([
    db.modelSetting.findMany(),
    db.authorPersona.findMany({ orderBy: { name: "asc" } }),
  ]);
  const settingByType = new Map(settings.map((s) => [s.mediaType, s.modelId]));

  let models: OpenRouterModel[] = [];
  let modelsError: string | null = null;
  try {
    models = await fetchOpenRouterModels();
  } catch (e) {
    modelsError = e instanceof Error ? e.message : "Couldn't load the model list.";
  }
  // Text (chat) models are what a persona can pin; audio models are separate.
  const textModels = models.filter((m) => !m.audioOutput);

  return (
    <div className="space-y-10">
      <div>
        <div className="eyebrow">Caddo State</div>
        <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          Media Settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose which OpenRouter model writes each type of media, and manage the
          author personas they write as.
        </p>
      </div>

      {/* Model per media type */}
      <section className="space-y-4">
        <h2 className="eyebrow !text-foreground">Models</h2>
        {modelsError ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-6 py-6 text-sm text-muted-foreground">
            Couldn&rsquo;t load OpenRouter&rsquo;s model list: {modelsError} Generation
            falls back to <span className="font-mono">{DEFAULT_MEDIA_MODEL}</span>.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {MEDIA_TYPES.map((t) => {
              // AUDIO narrates via an audio-output model; the rest use text models.
              const isAudio = t === "AUDIO";
              const list = isAudio ? models.filter((m) => m.audioOutput) : models.filter((m) => !m.audioOutput);
              return (
                <ModelPicker
                  key={t}
                  mediaType={t}
                  label={MEDIA_TYPE_LABELS[t]}
                  current={settingByType.get(t) ?? (isAudio ? DEFAULT_AUDIO_MODEL : DEFAULT_MEDIA_MODEL)}
                  models={list}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Author personas */}
      <section className="space-y-4">
        <h2 className="eyebrow !text-foreground">Author personas</h2>

        <div className="space-y-4">
          {personas.map((p) => (
            <div key={p.id} className="rounded-md border bg-card p-4">
              <SaveForm action={updatePersona} successText="Persona saved" className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid gap-2">
                  <Label htmlFor={`name-${p.id}`}>Name</Label>
                  <Input id={`name-${p.id}`} name="name" defaultValue={p.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`voice-${p.id}`}>Voice</Label>
                  <textarea
                    id={`voice-${p.id}`}
                    name="voice"
                    defaultValue={p.voice}
                    className={textareaClass}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`tts-${p.id}`}>Audio voice (radio)</Label>
                  <select
                    id={`tts-${p.id}`}
                    name="ttsVoice"
                    defaultValue={p.ttsVoice ?? DEFAULT_TTS_VOICE}
                    className={selectClass}
                  >
                    {AUDIO_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Text model</Label>
                  <PersonaModelSelect models={textModels} defaultValue={p.modelId ?? ""} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="active" defaultChecked={p.active} /> Active
                  </label>
                  <Button type="submit" size="sm">Save</Button>
                </div>
              </SaveForm>
              <div className="mt-3 border-t pt-3">
                <SaveForm action={deletePersona} successText="Persona deleted">
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmSubmit
                    message={`Delete the "${p.name}" persona?`}
                    className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
                  >
                    Delete persona
                  </ConfirmSubmit>
                </SaveForm>
              </div>
            </div>
          ))}
        </div>

        {/* Add persona */}
        <div className="rounded-md border border-dashed bg-muted/20 p-4">
          <h3 className="mb-3 font-semibold">Add a persona</h3>
          <SaveForm action={createPersona} successText="Persona added" className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" name="name" placeholder="e.g. The Homer, Analytics Desk" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-voice">Voice</Label>
              <textarea
                id="new-voice"
                name="voice"
                placeholder="How does this author write? Tone, focus, quirks…"
                className={textareaClass}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-tts">Audio voice (radio)</Label>
              <select id="new-tts" name="ttsVoice" defaultValue={DEFAULT_TTS_VOICE} className={selectClass}>
                {AUDIO_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Text model</Label>
              <PersonaModelSelect models={textModels} />
            </div>
            <Button type="submit" size="sm">Add persona</Button>
          </SaveForm>
        </div>
      </section>
    </div>
  );
}

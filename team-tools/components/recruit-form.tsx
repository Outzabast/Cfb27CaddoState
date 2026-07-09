"use client";

import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RECRUIT_STATUS_ORDER,
  RECRUIT_STATUS_LABELS,
  RECRUIT_KIND_ORDER,
  RECRUIT_KIND_LABELS,
} from "@/lib/recruits";
import type { RecruitStatus, RecruitKind } from "@/generated/prisma/enums";

export type RecruitFormValues = {
  id?: number;
  seasonId?: number;
  name?: string;
  position?: string;
  kind?: RecruitKind;
  previousSchool?: string | null;
  eligibilityYears?: number | null;
  height?: string;
  weightLbs?: number | null;
  hometownCity?: string | null;
  hometownState?: string | null;
  highSchool?: string | null;
  stars?: number;
  rating?: string;
  nationalRank?: number | null;
  positionRank?: number | null;
  stateRank?: number | null;
  status?: RecruitStatus;
  otherOffers?: string | null;
  bio?: string | null;
  notes?: string | null;
  hasPhoto?: boolean;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Create/edit form for a recruit's identity + 247-style scouting data. */
export function RecruitForm({
  action,
  seasons,
  values = {},
  submitLabel,
}: {
  action: (formData: FormData) => Promise<unknown>;
  seasons: { id: number; name: string }[];
  values?: RecruitFormValues;
  submitLabel: string;
}) {
  const v = values;
  return (
    <SaveForm action={action} successText="Recruit saved" className="space-y-5">
      {v.id != null && <input type="hidden" name="id" value={v.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={v.name ?? ""} placeholder="Prospect name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="seasonId">Recruiting class</Label>
          <select id="seasonId" name="seasonId" defaultValue={v.seasonId ?? seasons[0]?.id} className={selectClass}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="position">Position</Label>
          <Input id="position" name="position" defaultValue={v.position ?? ""} placeholder="e.g. QB, WR, EDGE" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status with us</Label>
          <select id="status" name="status" defaultValue={v.status ?? "TARGET"} className={selectClass}>
            {RECRUIT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {RECRUIT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="kind">Prospect type</Label>
          <select id="kind" name="kind" defaultValue={v.kind ?? "HIGH_SCHOOL"} className={selectClass}>
            {RECRUIT_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {RECRUIT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="previousSchool">Previous school (transfers)</Label>
          <Input id="previousSchool" name="previousSchool" defaultValue={v.previousSchool ?? ""} placeholder="e.g. Texas" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="eligibilityYears">Eligibility left (yrs)</Label>
          <Input id="eligibilityYears" name="eligibilityYears" type="number" min={0} max={5} defaultValue={v.eligibilityYears ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="stars">Stars (0–5)</Label>
          <Input id="stars" name="stars" type="number" min={0} max={5} defaultValue={v.stars ?? 0} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rating">Composite (0–1)</Label>
          <Input id="rating" name="rating" defaultValue={v.rating ?? ""} placeholder="0.9421" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="height">Height</Label>
          <Input id="height" name="height" defaultValue={v.height ?? ""} placeholder={`6'2"`} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="weightLbs">Weight (lbs)</Label>
          <Input id="weightLbs" name="weightLbs" type="number" defaultValue={v.weightLbs ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="nationalRank">National rank</Label>
          <Input id="nationalRank" name="nationalRank" type="number" defaultValue={v.nationalRank ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="positionRank">Position rank</Label>
          <Input id="positionRank" name="positionRank" type="number" defaultValue={v.positionRank ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stateRank">State rank</Label>
          <Input id="stateRank" name="stateRank" type="number" defaultValue={v.stateRank ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="highSchool">High school</Label>
          <Input id="highSchool" name="highSchool" defaultValue={v.highSchool ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hometownCity">Hometown city</Label>
          <Input id="hometownCity" name="hometownCity" defaultValue={v.hometownCity ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hometownState">State</Label>
          <Input id="hometownState" name="hometownState" defaultValue={v.hometownState ?? ""} placeholder="TX" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="otherOffers">Other offers / interest</Label>
        <Input id="otherOffers" name="otherOffers" defaultValue={v.otherOffers ?? ""} placeholder="Texas, LSU, …" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="bio">Scouting bio</Label>
        <textarea id="bio" name="bio" defaultValue={v.bio ?? ""} className={textareaClass} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Staff notes</Label>
        <textarea id="notes" name="notes" defaultValue={v.notes ?? ""} className={textareaClass} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="photo">Headshot (PNG)</Label>
        <input id="photo" name="photo" type="file" accept="image/png" className="text-sm" />
        {v.hasPhoto && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" name="removePhoto" /> Remove current photo
          </label>
        )}
      </div>

      <Button type="submit">{submitLabel}</Button>
    </SaveForm>
  );
}

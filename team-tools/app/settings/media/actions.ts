"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { MediaType } from "@/generated/prisma/enums";
import { MEDIA_TYPES } from "@/lib/media/constants";

const SETTINGS_PATH = "/settings/media";

function parseMediaType(raw: unknown): MediaType {
  const s = String(raw ?? "");
  if ((MEDIA_TYPES as string[]).includes(s)) return s as MediaType;
  throw new Error("Unknown media type.");
}

/** Set which OpenRouter model generates a given media type. */
export async function setMediaModel(formData: FormData) {
  const mediaType = parseMediaType(formData.get("mediaType"));
  const modelId = String(formData.get("modelId") ?? "").trim();
  if (!modelId) throw new Error("Choose a model.");

  await db.modelSetting.upsert({
    where: { mediaType },
    create: { mediaType, modelId },
    update: { modelId },
  });

  revalidatePath(SETTINGS_PATH);
}

/** Create a new author persona (byline + voice). */
export async function createPersona(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const voice = String(formData.get("voice") ?? "").trim();
  if (!name) throw new Error("Give the persona a name.");
  if (!voice) throw new Error("Describe how this author writes.");

  await db.authorPersona.create({ data: { name, voice } });
  revalidatePath(SETTINGS_PATH);
}

/** Update a persona's name, voice, and active flag. */
export async function updatePersona(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad persona id.");
  const name = String(formData.get("name") ?? "").trim();
  const voice = String(formData.get("voice") ?? "").trim();
  if (!name) throw new Error("Give the persona a name.");
  if (!voice) throw new Error("Describe how this author writes.");

  await db.authorPersona.update({
    where: { id },
    data: { name, voice, active: formData.get("active") != null },
  });
  revalidatePath(SETTINGS_PATH);
}

/** Delete a persona. Media it wrote keeps its text (authorPersonaId is nulled). */
export async function deletePersona(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad persona id.");
  await db.authorPersona.delete({ where: { id } });
  revalidatePath(SETTINGS_PATH);
}

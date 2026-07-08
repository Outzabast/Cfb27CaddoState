-- Per-persona text model override (null = use the media type's ModelSetting).
ALTER TABLE "author_personas" ADD COLUMN "model_id" TEXT;

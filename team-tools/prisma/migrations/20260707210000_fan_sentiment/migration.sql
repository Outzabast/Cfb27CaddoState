-- Fan sentiment (0-100) + optional manual baseline override, per season.
ALTER TABLE "seasons" ADD COLUMN "fan_sentiment" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "seasons" ADD COLUMN "sentiment_baseline_override" INTEGER;

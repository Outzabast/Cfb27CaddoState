import { redirect } from "next/navigation";
import { getCurrentSeasonId } from "@/lib/season";

// Stable entry point for "the current season" — always resolves to the latest.
export default async function CurrentSeasonRedirect() {
  const id = await getCurrentSeasonId();
  redirect(id ? `/seasons/${id}` : "/seasons");
}

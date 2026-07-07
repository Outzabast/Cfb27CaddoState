"use client";

import { useEffect } from "react";
import { markMediaViewed } from "@/app/media/actions";

/** Marks a piece read once it's opened (fire-and-forget on mount). */
export function MarkViewed({ id, viewed }: { id: number; viewed: boolean }) {
  useEffect(() => {
    if (!viewed) void markMediaViewed(id);
  }, [id, viewed]);
  return null;
}

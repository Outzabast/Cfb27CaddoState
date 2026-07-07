import type { StaffRole } from "@/generated/prisma/enums";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  HEAD_COACH: "Head Coach",
  OFFENSIVE_COORDINATOR: "Offensive Coordinator",
  DEFENSIVE_COORDINATOR: "Defensive Coordinator",
};

/** Display order for the season staff section. */
export const STAFF_ROLES: StaffRole[] = [
  "HEAD_COACH",
  "OFFENSIVE_COORDINATOR",
  "DEFENSIVE_COORDINATOR",
];

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === "string" && v in STAFF_ROLE_LABELS;
}

import type { Role } from "@/app/generated/prisma";

const HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ANALYST: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasAtLeastRole(actual: Role, required: Role): boolean {
  return HIERARCHY[actual] >= HIERARCHY[required];
}

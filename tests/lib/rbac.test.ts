import { describe, expect, test } from "vitest";
import { hasAtLeastRole } from "@/lib/rbac/hierarchy";

describe("hasAtLeastRole", () => {
  test("VIEWER < OPERATOR < ANALYST < ADMIN < SUPER_ADMIN", () => {
    expect(hasAtLeastRole("SUPER_ADMIN", "VIEWER")).toBe(true);
    expect(hasAtLeastRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(hasAtLeastRole("ADMIN", "ANALYST")).toBe(true);
    expect(hasAtLeastRole("ANALYST", "OPERATOR")).toBe(true);
    expect(hasAtLeastRole("OPERATOR", "VIEWER")).toBe(true);
  });

  test("rejects insufficient role", () => {
    expect(hasAtLeastRole("VIEWER", "OPERATOR")).toBe(false);
    expect(hasAtLeastRole("OPERATOR", "ANALYST")).toBe(false);
    expect(hasAtLeastRole("ANALYST", "ADMIN")).toBe(false);
    expect(hasAtLeastRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  test("equal roles satisfy", () => {
    expect(hasAtLeastRole("ANALYST", "ANALYST")).toBe(true);
  });
});

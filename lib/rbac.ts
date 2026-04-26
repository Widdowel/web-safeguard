import { Role } from "@/app/generated/prisma";
import { auth } from "@/auth";
import { hasAtLeastRole } from "@/lib/rbac/hierarchy";

export { hasAtLeastRole } from "@/lib/rbac/hierarchy";

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email || !user.role) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role as Role,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Authentication required");
  return user;
}

export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!allowed.some((role) => hasAtLeastRole(user.role, role))) {
    throw new AuthorizationError(
      `Role ${user.role} cannot perform this action (requires one of: ${allowed.join(", ")})`,
    );
  }
  return user;
}

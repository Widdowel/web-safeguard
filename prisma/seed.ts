import { hash } from "bcryptjs";
import { PrismaClient, Role } from "../app/generated/prisma";

const prisma = new PrismaClient();

const SEED_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@web-safeguard.local";
const SEED_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe!2026";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: SEED_EMAIL } });
  if (existing) {
    console.log(`✓ Super admin already exists: ${SEED_EMAIL}`);
    return;
  }

  const hashedPassword = await hash(SEED_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: SEED_EMAIL,
      name: "Super Admin",
      hashedPassword,
      role: Role.SUPER_ADMIN,
      emailVerified: new Date(),
    },
  });

  console.log(`✓ Super admin created: ${user.email}`);
  console.log(`  Default password: ${SEED_PASSWORD}`);
  console.log("  ⚠️  Change this password immediately after first login.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

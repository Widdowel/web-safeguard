import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { WebSocket } from "ws";
import { PrismaClient } from "@/app/generated/prisma";
import { env, isNeon, isProduction } from "@/lib/env";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function buildClient(): PrismaClient {
  if (isNeon) {
    neonConfig.webSocketConstructor = WebSocket;
    const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaPg(env.DATABASE_URL);
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = global.prismaGlobal ?? buildClient();

if (!isProduction) global.prismaGlobal = prisma;

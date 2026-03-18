import { PrismaClient } from "@prisma/client";

export const workerDb = new PrismaClient({
  log: ["error", "warn"]
});


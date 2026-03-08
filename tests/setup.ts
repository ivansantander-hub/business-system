import { prisma } from "@/lib/prisma";
import { afterAll } from "vitest";

afterAll(async () => {
  await prisma.$disconnect();
});

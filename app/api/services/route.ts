import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

const ServiceSchema = z.object({
  name: z.string().min(1).max(100),
  durationMinutes: z.number().int().min(15).max(480),
  priceCents: z.number().int().min(0).max(1_000_000),
  capacity: z.number().int().min(1).max(50).optional(),
});

export async function GET() {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const services = await prisma.service.findMany({
    where: { coachId: auth.coachId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(services);
}

export async function POST(req: Request) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = ServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: { ...parsed.data, coachId: auth.coachId },
  });
  return NextResponse.json(service);
}

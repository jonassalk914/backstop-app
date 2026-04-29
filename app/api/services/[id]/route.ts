import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify ownership
  const service = await prisma.service.findFirst({
    where: { id: params.id, coachId: auth.coachId },
  });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.service.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const service = await prisma.service.findFirst({
    where: { id: params.id, coachId: auth.coachId },
  });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-delete via active flag — keeps booking history intact
  await prisma.service.update({
    where: { id: params.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}

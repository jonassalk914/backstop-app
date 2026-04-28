import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

const WindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
}).refine((w) => w.endMinute > w.startMinute, "end must be after start");

const PutSchema = z.object({
  windows: z.array(WindowSchema).max(50),
});

export async function GET() {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const windows = await prisma.availability.findMany({
    where: { coachId: auth.coachId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });
  return NextResponse.json(windows);
}

/**
 * Replace the entire weekly schedule. Simpler than per-window CRUD —
 * client sends the full set, we wipe and recreate in a transaction.
 */
export async function PUT(req: Request) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { coachId: auth.coachId } }),
    prisma.availability.createMany({
      data: parsed.data.windows.map((w) => ({ ...w, coachId: auth.coachId })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}

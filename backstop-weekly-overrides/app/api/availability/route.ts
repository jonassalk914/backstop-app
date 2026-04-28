import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";
import { getScheduleData } from "@/lib/booking";

/**
 * GET /api/availability
 * Returns { weekly, overrides } for the schedule UI.
 * Overrides cover the next 60 days from today.
 */
export async function GET() {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const data = await getScheduleData(auth.coachId, 60);
  return NextResponse.json(data);
}

const WindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
}).refine((w) => w.endMinute > w.startMinute, "end must be after start");

const PutSchema = z.object({
  windows: z.array(WindowSchema).max(50),
});

/**
 * PUT /api/availability
 * Replaces the entire weekly schedule. Overrides are NOT touched.
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

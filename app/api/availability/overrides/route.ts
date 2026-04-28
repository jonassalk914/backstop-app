import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";
import { parseDateString } from "@/lib/booking";

const PostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["ADD", "BLOCK"]),
  // If both null, override applies to the whole day.
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  endMinute: z.number().int().min(1).max(1440).nullable().optional(),
}).refine(
  (d) => {
    // Either both null/undefined (whole-day) or both set with end > start
    const sNull = d.startMinute === null || d.startMinute === undefined;
    const eNull = d.endMinute === null || d.endMinute === undefined;
    if (sNull && eNull) return true;
    if (sNull !== eNull) return false;
    return (d.endMinute as number) > (d.startMinute as number);
  },
  { message: "Provide both start and end times, with end after start (or omit both for a whole-day override)." }
);

/**
 * POST /api/availability/overrides
 * Body: { date, type: "ADD"|"BLOCK", startMinute?, endMinute? }
 * Omit start/end for a whole-day override.
 */
export async function POST(req: Request) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const date = parseDateString(parsed.data.date);
  if (!date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const created = await prisma.availabilityOverride.create({
    data: {
      coachId: auth.coachId,
      date,
      type: parsed.data.type,
      startMinute: parsed.data.startMinute ?? null,
      endMinute: parsed.data.endMinute ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

/**
 * DELETE /api/availability/overrides?id=...
 */
export async function DELETE(req: Request) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const row = await prisma.availabilityOverride.findFirst({
    where: { id, coachId: auth.coachId },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.availabilityOverride.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

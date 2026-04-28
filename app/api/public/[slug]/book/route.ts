import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { upsertPlayer } from "@/lib/player";
import { createBookingAtomic } from "@/lib/booking";

const BookSchema = z.object({
  serviceId: z.string().min(1),
  startTime: z.string().datetime(),
  playerName: z.string().min(1).max(100),
  playerEmail: z.string().email().optional().or(z.literal("")),
  playerPhone: z.string().min(7).max(30).optional().or(z.literal("")),
  paymentMethod: z.string().max(50).optional(),
}).refine(
  (d) => (d.playerEmail && d.playerEmail.length > 0) || (d.playerPhone && d.playerPhone.length > 0),
  "Email or phone required"
);

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const coach = await prisma.coach.findUnique({
    where: { slug: params.slug },
    select: { id: true, enabled: true },
  });
  if (!coach || !coach.enabled) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, coachId: coach.id, active: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Service not available" }, { status: 404 });
  }

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000);

  // Reject obviously bogus times
  if (startTime < new Date()) {
    return NextResponse.json({ error: "Cannot book in the past" }, { status: 400 });
  }

  const player = await upsertPlayer({
    coachId: coach.id,
    name: parsed.data.playerName.trim(),
    email: parsed.data.playerEmail || undefined,
    phone: parsed.data.playerPhone || undefined,
  });

  const result = await createBookingAtomic({
    coachId: coach.id,
    serviceId: service.id,
    playerId: player.id,
    startTime,
    endTime,
    priceCents: service.priceCents,
    paymentMethod: parsed.data.paymentMethod,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ ok: true, bookingId: result.bookingId });
}

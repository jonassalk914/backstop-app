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

/**
 * POST /api/public/[slug]/book
 * ALWAYS returns JSON. Any thrown error becomes a 500 with a JSON body.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BookSchema.safeParse(body);
    if (!parsed.success) {
      return jsonNoStore(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        400
      );
    }

    const coach = await prisma.coach.findUnique({
      where: { slug: params.slug },
      select: { id: true, enabled: true },
    });
    if (!coach || !coach.enabled) {
      return jsonNoStore({ error: "Coach not found" }, 404);
    }

    const service = await prisma.service.findFirst({
      where: { id: parsed.data.serviceId, coachId: coach.id, active: true },
    });
    if (!service) {
      return jsonNoStore({ error: "Service not available" }, 404);
    }

    const startTime = new Date(parsed.data.startTime);
    if (isNaN(startTime.getTime())) {
      return jsonNoStore({ error: "Invalid start time" }, 400);
    }
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000);

    if (startTime < new Date()) {
      return jsonNoStore({ error: "Cannot book in the past" }, 400);
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
      capacity: service.capacity,
      paymentMethod: parsed.data.paymentMethod,
    });

    if (!result.ok) {
      return jsonNoStore({ error: result.reason }, 409);
    }

    return jsonNoStore({ ok: true, bookingId: result.bookingId });
  } catch (err) {
    console.error("[book] unexpected error:", err);
    return jsonNoStore({ error: "Booking failed. Please try again." }, 500);
  }
}

function jsonNoStore(body: unknown, status: number = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

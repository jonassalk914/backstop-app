import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSlotsForDate, getAvailableDates } from "@/lib/booking";

/**
 * GET /api/public/[slug]/slots?serviceId=...&date=YYYY-MM-DD
 *
 * - With `date`: returns slots available on that specific calendar date.
 * - Without `date`: returns the list of dates in the next 60 days where
 *   the coach has any effective availability (used by the calendar picker).
 *
 * ALWAYS returns JSON. Any thrown error is caught and returned as a 500
 * with a JSON body so the client can never receive HTML/empty responses.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId");
    const date = url.searchParams.get("date");

    if (!serviceId) {
      return jsonNoStore({ error: "serviceId required" }, 400);
    }

    const coach = await prisma.coach.findUnique({
      where: { slug: params.slug },
      select: { id: true, enabled: true, timezone: true },
    });
    if (!coach || !coach.enabled) {
      return jsonNoStore({ error: "Coach not found" }, 404);
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, coachId: coach.id, active: true },
      select: { id: true, durationMinutes: true },
    });
    if (!service) {
      return jsonNoStore({ error: "Service not found" }, 404);
    }

    if (date) {
      const slots = await getSlotsForDate(coach.id, service.durationMinutes, date, coach.timezone);
      return jsonNoStore({
        date,
        timezone: coach.timezone,
        slots: slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
      });
    }

    const availableDates = await getAvailableDates(coach.id, 60, coach.timezone);
    return jsonNoStore({ availableDates, timezone: coach.timezone });
  } catch (err) {
    console.error("[slots] unexpected error:", err);
    return jsonNoStore({ error: "Failed to load availability." }, 500);
  }
}

function jsonNoStore(body: unknown, status: number = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/booking";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId required" }, { status: 400 });
  }

  const coach = await prisma.coach.findUnique({
    where: { slug: params.slug },
    select: { id: true, enabled: true },
  });
  if (!coach || !coach.enabled) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, coachId: coach.id, active: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const slots = await getAvailableSlots(coach.id, service.durationMinutes, 14);
  return NextResponse.json({
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

export async function GET(req: Request) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter"); // "upcoming" | "past" | "unpaid" | null
  const playerId = url.searchParams.get("playerId");

  const where: any = { coachId: auth.coachId };
  const now = new Date();

  if (filter === "upcoming") where.startTime = { gte: now };
  if (filter === "past") where.startTime = { lt: now };
  if (filter === "unpaid") where.paymentStatus = { in: ["UNPAID", "PARTIAL"] };
  if (playerId) where.playerId = playerId;

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      player: { select: { id: true, name: true, email: true, phone: true } },
      service: { select: { id: true, name: true } },
    },
    orderBy: { startTime: filter === "past" ? "desc" : "asc" },
    take: 200,
  });

  return NextResponse.json(bookings);
}

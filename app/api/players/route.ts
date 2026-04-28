import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

export async function GET() {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const now = new Date();
  const players = await prisma.player.findMany({
    where: { coachId: auth.coachId },
    include: {
      bookings: {
        select: { id: true, startTime: true, status: true, paymentStatus: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute aggregates per spec: total, upcoming, completed, last activity
  const enriched = players.map((p) => {
    const bookings = p.bookings.filter((b) => b.status !== "CANCELLED");
    const upcoming = bookings.filter((b) => b.startTime >= now).length;
    const completed = bookings.filter((b) => b.startTime < now).length;
    const lastActivity = bookings
      .map((b) => b.startTime)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? p.createdAt;

    return {
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      totalBookings: bookings.length,
      upcomingBookings: upcoming,
      completedBookings: completed,
      lastActivity,
    };
  });

  return NextResponse.json(enriched);
}

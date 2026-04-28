import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const coaches = await prisma.coach.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      slug: true,
      enabled: true,
      createdAt: true,
      _count: {
        select: { players: true, bookings: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    coaches.map((c) => ({
      id: c.id,
      email: c.email,
      name: `${c.firstName} ${c.lastName}`,
      slug: c.slug,
      enabled: c.enabled,
      createdAt: c.createdAt,
      playerCount: c._count.players,
      bookingCount: c._count.bookings,
    }))
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

export async function GET() {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const bookings = await prisma.booking.findMany({
    where: {
      coachId: auth.coachId,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      startTime: true,
      priceCents: true,
      amountPaidCents: true,
      paymentStatus: true,
      paidAt: true,
      service: { select: { id: true, name: true } },
      player: { select: { id: true, name: true } },
    },
  });

  // Top-line numbers
  let revenueThisMonthCents = 0;
  let projectedUpcomingCents = 0;
  let unpaidBalanceCents = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  for (const b of bookings) {
    const isPaid = b.paymentStatus === "PAID";
    const isUpcoming = b.startTime >= now;

    if (isPaid && b.paidAt && b.paidAt >= monthStart) {
      revenueThisMonthCents += b.amountPaidCents;
    }
    if (isUpcoming) {
      projectedUpcomingCents += b.priceCents - b.amountPaidCents;
    }
    if (b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL") {
      unpaidBalanceCents += b.priceCents - b.amountPaidCents;
      unpaidCount++;
    } else if (isPaid) {
      paidCount++;
    }
  }

  // Revenue by service (paid only)
  const byService = new Map<string, { name: string; cents: number }>();
  for (const b of bookings) {
    if (b.paymentStatus !== "PAID") continue;
    const key = b.service.id;
    const cur = byService.get(key) ?? { name: b.service.name, cents: 0 };
    cur.cents += b.amountPaidCents;
    byService.set(key, cur);
  }

  // Revenue by player (paid only, top 10)
  const byPlayer = new Map<string, { name: string; cents: number }>();
  for (const b of bookings) {
    if (b.paymentStatus !== "PAID") continue;
    const key = b.player.id;
    const cur = byPlayer.get(key) ?? { name: b.player.name, cents: 0 };
    cur.cents += b.amountPaidCents;
    byPlayer.set(key, cur);
  }

  // Monthly trend (last 6 months including current)
  const monthlyTrend: { month: string; cents: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    let cents = 0;
    for (const b of bookings) {
      if (b.paymentStatus === "PAID" && b.paidAt && b.paidAt >= m && b.paidAt < next) {
        cents += b.amountPaidCents;
      }
    }
    monthlyTrend.push({
      month: m.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      cents,
    });
  }

  // Unpaid bookings list
  const unpaidBookings = bookings
    .filter((b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL")
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, 50)
    .map((b) => ({
      id: b.id,
      startTime: b.startTime,
      playerName: b.player.name,
      serviceName: b.service.name,
      priceCents: b.priceCents,
      amountPaidCents: b.amountPaidCents,
      paymentStatus: b.paymentStatus,
    }));

  return NextResponse.json({
    revenueThisMonthCents,
    projectedUpcomingCents,
    unpaidBalanceCents,
    paidCount,
    unpaidCount,
    revenueByService: Array.from(byService.values()).sort((a, b) => b.cents - a.cents),
    revenueByPlayer: Array.from(byPlayer.values()).sort((a, b) => b.cents - a.cents).slice(0, 10),
    monthlyTrend,
    unpaidBookings,
  });
}

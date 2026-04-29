import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

/**
 * DELETE /api/players/[id]
 *
 * Hard-deletes a player from the coach's directory. Rejected with a clear
 * 409 if the player has any bookings (Booking → Player cascade-deletes,
 * so a hard delete would wipe history and skew finances). Coach cancels
 * those bookings first, then deletes the player.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const player = await prisma.player.findFirst({
    where: { id: params.id, coachId: auth.coachId },
    select: { id: true, _count: { select: { bookings: true } } },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (player._count.bookings > 0) {
    return NextResponse.json(
      {
        error: `This player has ${player._count.bookings} booking${player._count.bookings === 1 ? "" : "s"}. Cancel or delete those first to keep your booking history and finances intact.`,
      },
      { status: 409 }
    );
  }

  await prisma.player.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

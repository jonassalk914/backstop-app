import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";

const UpdateSchema = z.object({
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "CANCELLED"]).optional(),
  amountPaidCents: z.number().int().min(0).optional(),
  paymentMethod: z.string().max(50).optional().nullable(),
  paymentNotes: z.string().max(500).optional().nullable(),
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, coachId: auth.coachId },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-set paidAt when status flips to PAID
  const data: any = { ...parsed.data };
  if (parsed.data.paymentStatus === "PAID" && !booking.paidAt) {
    data.paidAt = new Date();
    if (data.amountPaidCents === undefined) {
      data.amountPaidCents = booking.priceCents;
    }
  }
  if (parsed.data.paymentStatus === "UNPAID") {
    data.paidAt = null;
    if (data.amountPaidCents === undefined) data.amountPaidCents = 0;
  }

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, coachId: auth.coachId },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark cancelled rather than hard-delete — keeps audit trail
  await prisma.booking.update({
    where: { id: params.id },
    data: { status: "CANCELLED", paymentStatus: "CANCELLED" },
  });
  return NextResponse.json({ ok: true });
}

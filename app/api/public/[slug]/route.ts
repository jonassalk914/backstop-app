import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const coach = await prisma.coach.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      slug: true,
      enabled: true,
      paymentMethods: true,
      paymentInstructions: true,
      services: {
        where: { active: true },
        select: { id: true, name: true, durationMinutes: true, priceCents: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!coach || !coach.enabled) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  return NextResponse.json(coach);
}

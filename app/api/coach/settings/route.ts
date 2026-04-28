import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";
import { isValidSlug } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezone";

const SettingsSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(30).optional().nullable(),
  slug: z.string().max(50).optional(),
  paymentInstructions: z.string().max(1000).optional().nullable(),
  paymentMethods: z.array(z.string().max(50)).max(10).optional(),
  timezone: z.string().max(64).optional(),
});

export async function GET() {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const coach = await prisma.coach.findUnique({
    where: { id: auth.coachId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      slug: true,
      phone: true,
      paymentInstructions: true,
      paymentMethods: true,
      timezone: true,
    },
  });
  return NextResponse.json(coach);
}

export async function PATCH(req: Request) {
  const auth = await requireCoach();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Slug change: validate format and uniqueness
  if (parsed.data.slug) {
    const desired = parsed.data.slug.toLowerCase();
    if (!isValidSlug(desired)) {
      return NextResponse.json(
        { error: "Slug must be 2-50 chars, lowercase letters/numbers/hyphens only, and not reserved." },
        { status: 400 }
      );
    }
    const taken = await prisma.coach.findFirst({
      where: { slug: desired, id: { not: auth.coachId } },
    });
    if (taken) {
      return NextResponse.json({ error: "That booking link is taken." }, { status: 409 });
    }
    parsed.data.slug = desired;
  }

  if (parsed.data.timezone && !isValidTimezone(parsed.data.timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  const updated = await prisma.coach.update({
    where: { id: auth.coachId },
    data: parsed.data,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      slug: true, phone: true, paymentInstructions: true, paymentMethods: true,
      timezone: true,
    },
  });
  return NextResponse.json(updated);
}

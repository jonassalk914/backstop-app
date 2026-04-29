import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoach } from "@/lib/guards";
import { isValidSlug } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezone";

// Public-page branding fields are all nullable strings. Lengths sized for
// real-world inputs (a tweet-length bio, a single emoji-friendly handle, etc.)
// — the validator stops obvious abuse without micromanaging UX.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const URL_PATTERN = /^https?:\/\/[^\s]{4,2000}$/i;

const SettingsSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(30).optional().nullable(),
  slug: z.string().max(50).optional(),
  paymentInstructions: z.string().max(1000).optional().nullable(),
  paymentMethods: z.array(z.string().max(50)).max(10).optional(),
  timezone: z.string().max(64).optional(),

  // Public booking page customization
  displayName: z.string().max(80).optional().nullable(),
  bio: z.string().max(600).optional().nullable(),
  publicEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  accentColor: z.string().regex(HEX_COLOR, "Use #RRGGBB hex").optional().nullable().or(z.literal("")),
  logoUrl: z.string().regex(URL_PATTERN, "Must be an http(s) URL").optional().nullable().or(z.literal("")),
  venmoHandle: z.string().max(60).optional().nullable(),
  cashAppHandle: z.string().max(60).optional().nullable(),
  zelleInfo: z.string().max(200).optional().nullable(),
  cashInstructions: z.string().max(300).optional().nullable(),
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
      displayName: true,
      bio: true,
      publicEmail: true,
      accentColor: true,
      logoUrl: true,
      venmoHandle: true,
      cashAppHandle: true,
      zelleInfo: true,
      cashInstructions: true,
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

  // Normalize empty-string optional inputs to null so the DB column is
  // either set or unset rather than holding an empty string.
  const data: Record<string, unknown> = { ...parsed.data };
  for (const k of ["publicEmail", "accentColor", "logoUrl"] as const) {
    if (data[k] === "") data[k] = null;
  }

  const updated = await prisma.coach.update({
    where: { id: auth.coachId },
    data,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      slug: true, phone: true, paymentInstructions: true, paymentMethods: true,
      timezone: true,
      displayName: true, bio: true, publicEmail: true, accentColor: true,
      logoUrl: true, venmoHandle: true, cashAppHandle: true, zelleInfo: true,
      cashInstructions: true,
    },
  });
  return NextResponse.json(updated);
}

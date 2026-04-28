import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateUniqueSlug } from "@/lib/slug";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
});

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.coach.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const slug = await generateUniqueSlug(parsed.data.firstName, parsed.data.lastName);

  const coach = await prisma.coach.create({
    data: {
      email,
      passwordHash,
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      slug,
      // Sensible defaults so dashboard isn't empty on day 1
      paymentMethods: ["Venmo", "Cash"],
      availability: {
        create: [
          // Mon-Fri 4pm-8pm by default — common after-school coaching window
          { dayOfWeek: 1, startMinute: 16 * 60, endMinute: 20 * 60 },
          { dayOfWeek: 2, startMinute: 16 * 60, endMinute: 20 * 60 },
          { dayOfWeek: 3, startMinute: 16 * 60, endMinute: 20 * 60 },
          { dayOfWeek: 4, startMinute: 16 * 60, endMinute: 20 * 60 },
          { dayOfWeek: 5, startMinute: 16 * 60, endMinute: 20 * 60 },
        ],
      },
    },
  });

  return NextResponse.json({ ok: true, slug: coach.slug });
}

import { prisma } from "./prisma";

/**
 * Find-or-create a player for a coach, deduping on phone first, then email.
 *
 * Edge case: returning player provides phone this time but only had email
 * before (or vice versa). We match on whichever was given AND known, then
 * backfill the missing field.
 */
export async function upsertPlayer(args: {
  coachId: string;
  name: string;
  email?: string;
  phone?: string;
}) {
  const email = args.email?.trim().toLowerCase() || null;
  const phone = args.phone?.replace(/\D/g, "") || null;

  if (!email && !phone) {
    throw new Error("Player must have phone or email");
  }

  // Try phone match first
  let existing = phone
    ? await prisma.player.findUnique({
        where: { coachId_phone: { coachId: args.coachId, phone } },
      })
    : null;

  // Fall back to email match
  if (!existing && email) {
    existing = await prisma.player.findUnique({
      where: { coachId_email: { coachId: args.coachId, email } },
    });
  }

  if (existing) {
    // Backfill missing contact info, update name if changed
    const updates: any = {};
    if (!existing.email && email) updates.email = email;
    if (!existing.phone && phone) updates.phone = phone;
    if (existing.name !== args.name) updates.name = args.name;

    if (Object.keys(updates).length > 0) {
      return await prisma.player.update({
        where: { id: existing.id },
        data: updates,
      });
    }
    return existing;
  }

  return await prisma.player.create({
    data: {
      coachId: args.coachId,
      name: args.name,
      email,
      phone,
    },
  });
}

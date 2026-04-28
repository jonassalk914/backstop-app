import { prisma } from "./prisma";

const RESERVED = new Set([
  "admin", "api", "book", "login", "signup", "logout", "dashboard",
  "settings", "auth", "static", "_next", "favicon", "robots", "sitemap",
  "founder", "support", "help", "about", "terms", "privacy",
]);

function baseSlug(firstName: string, lastName: string): string {
  const raw = `${firstName} ${lastName}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return raw || "coach";
}

/** Generate a unique slug. Tries base, then base-2, base-3, ... */
export async function generateUniqueSlug(firstName: string, lastName: string): Promise<string> {
  const base = baseSlug(firstName, lastName);
  let candidate = RESERVED.has(base) ? `${base}-coach` : base;
  let n = 2;

  while (true) {
    const existing = await prisma.coach.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = `${RESERVED.has(base) ? `${base}-coach` : base}-${n}`;
    n++;
    if (n > 1000) {
      // pathological — fall back to random suffix
      return `${base}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 50) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  if (RESERVED.has(slug)) return false;
  return true;
}

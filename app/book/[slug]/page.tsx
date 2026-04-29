import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingFlow } from "@/components/BookingFlow";

const DEFAULT_ACCENT = "#d4ff00";
const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function BookPage({ params }: { params: { slug: string } }) {
  const coach = await prisma.coach.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      slug: true,
      enabled: true,
      timezone: true,
      phone: true,
      paymentMethods: true,
      paymentInstructions: true,
      displayName: true,
      bio: true,
      publicEmail: true,
      accentColor: true,
      logoUrl: true,
      venmoHandle: true,
      cashAppHandle: true,
      zelleInfo: true,
      cashInstructions: true,
      services: {
        where: { active: true },
        select: { id: true, name: true, durationMinutes: true, priceCents: true, capacity: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!coach || !coach.enabled) notFound();

  const accent = coach.accentColor && HEX.test(coach.accentColor) ? coach.accentColor : DEFAULT_ACCENT;
  const headline = (coach.displayName?.trim() || `${coach.firstName} ${coach.lastName}`).toUpperCase();
  const hasContact = !!(coach.publicEmail || coach.phone);

  return (
    <main className="min-h-screen bg-bg bg-grid coach-public" style={{ ["--coach-accent" as any]: accent }}>
      {/* Per-coach scoped accent override. Only `.coach-public` scopes are
          affected, so other coaches' pages and the dashboard stay default. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .coach-public .bg-signal { background-color: var(--coach-accent); }
        .coach-public .text-signal { color: var(--coach-accent); }
        .coach-public .border-signal { border-color: var(--coach-accent); }
        .coach-public .hover\\:bg-signal-dim:hover { background-color: var(--coach-accent); filter: brightness(0.85); }
        .coach-public .hover\\:border-signal:hover { border-color: var(--coach-accent); }
        .coach-public .border-signal\\/40 { border-color: color-mix(in srgb, var(--coach-accent) 40%, transparent); }
        .coach-public .border-signal\\/60 { border-color: color-mix(in srgb, var(--coach-accent) 60%, transparent); }
        .coach-public .bg-signal\\/10 { background-color: color-mix(in srgb, var(--coach-accent) 10%, transparent); }
      `}} />

      <header className="border-b border-line">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-2">
          <div className="w-3 h-3 bg-signal rotate-45" />
          <span className="h-display text-xl tracking-wider">BACKSTOP</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-start gap-4">
          {coach.logoUrl && (
            // Decorative — no alt content meaningful beyond the headline
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coach.logoUrl}
              alt=""
              className="w-16 h-16 object-cover border border-line shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-signal text-xs tracking-widest mb-3 font-mono">BOOK A SESSION WITH</div>
            <h1 className="h-display text-5xl tracking-wider mb-2 break-words">{headline}</h1>
          </div>
        </div>

        {coach.bio && (
          <p className="text-ink-muted text-sm mt-4 whitespace-pre-wrap">{coach.bio}</p>
        )}

        {hasContact && (
          <div className="text-xs font-mono text-ink-dim mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {coach.publicEmail && <span>📧 {coach.publicEmail}</span>}
            {coach.phone && <span>📱 {coach.phone}</span>}
          </div>
        )}

        <div className="mt-10">
          <BookingFlow
            slug={coach.slug}
            services={coach.services}
            paymentMethods={coach.paymentMethods}
            paymentInstructions={coach.paymentInstructions}
            timezone={coach.timezone}
            paymentHandles={{
              venmo: coach.venmoHandle,
              cashApp: coach.cashAppHandle,
              zelle: coach.zelleInfo,
              cash: coach.cashInstructions,
            }}
          />
        </div>
      </div>

      <footer className="border-t border-line py-6 mt-12">
        <div className="max-w-2xl mx-auto px-6 text-ink-dim text-xs font-mono text-center">
          Powered by BACKSTOP
        </div>
      </footer>
    </main>
  );
}

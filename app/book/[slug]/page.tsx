import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingFlow } from "@/components/BookingFlow";

export default async function BookPage({ params }: { params: { slug: string } }) {
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

  if (!coach || !coach.enabled) notFound();

  return (
    <main className="min-h-screen bg-bg bg-grid">
      <header className="border-b border-line">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-2">
          <div className="w-3 h-3 bg-signal rotate-45" />
          <span className="h-display text-xl tracking-wider">BACKSTOP</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-signal text-xs tracking-widest mb-3 font-mono">BOOK A SESSION WITH</div>
        <h1 className="h-display text-5xl tracking-wider mb-2">
          {coach.firstName.toUpperCase()} {coach.lastName.toUpperCase()}
        </h1>

        <div className="mt-10">
          <BookingFlow
            slug={coach.slug}
            services={coach.services}
            paymentMethods={coach.paymentMethods}
            paymentInstructions={coach.paymentInstructions}
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

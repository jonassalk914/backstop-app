import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, isAdminEmail } from "@/lib/auth";
import { DashboardNav } from "@/components/DashboardNav";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login?from=/dashboard");

  const coach = await prisma.coach.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { firstName: true, lastName: true, slug: true, enabled: true },
  });

  if (!coach) redirect("/login");
  if (!coach.enabled) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-bad font-mono text-xs tracking-widest mb-4">ACCOUNT DISABLED</div>
          <h1 className="h-display text-4xl mb-3">Hold up.</h1>
          <p className="text-ink-muted">
            Your account has been disabled. Contact support to restore access.
          </p>
        </div>
      </main>
    );
  }

  const isAdmin = isAdminEmail(session.user.email);

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav
        coachName={`${coach.firstName} ${coach.lastName}`}
        slug={coach.slug}
        isAdmin={isAdmin}
      />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

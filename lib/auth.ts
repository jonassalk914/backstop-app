import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const coach = await prisma.coach.findUnique({ where: { email } });
        if (!coach) return null;
        if (!coach.enabled) return null;

        const ok = await bcrypt.compare(credentials.password, coach.passwordHash);
        if (!ok) return null;

        return {
          id: coach.id,
          email: coach.email,
          name: `${coach.firstName} ${coach.lastName}`,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.coachId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.coachId) {
        (session.user as any).coachId = token.coachId;
      }
      return session;
    },
  },
};

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "founder@backstopapp.com").toLowerCase();

export function isAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}

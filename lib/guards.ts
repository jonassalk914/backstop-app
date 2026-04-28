import { getServerSession } from "next-auth";
import { authOptions, isAdminEmail } from "./auth";
import { NextResponse } from "next/server";

export async function requireCoach() {
  const session = await getServerSession(authOptions);
  const coachId = (session?.user as any)?.coachId;
  if (!coachId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { coachId, email: session!.user!.email! };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!isAdminEmail(email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { email: email! };
}

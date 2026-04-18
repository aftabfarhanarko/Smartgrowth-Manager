import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      userId: session.userId,
      companyId: session.companyId,
      role: session.userRole,
      name: session.name,
      email: session.email,
    },
  });
}

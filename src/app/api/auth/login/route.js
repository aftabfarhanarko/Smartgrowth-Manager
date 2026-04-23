import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import { createSessionToken, getSessionCookieName } from "@/lib/session";

export async function POST(request) {
  const body = await request.json();
  const email = body?.email?.toLowerCase()?.trim();
  const password = body?.password;

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  await connectDB();
  const user = await User.findOne({ email, isActive: true });
  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  const activeSubscription = await Subscription.findOne({
    companyId: user.companyId,
    status: "active",
  }).sort({ createdAt: -1 });

  if (!activeSubscription) {
    return NextResponse.json(
      {
        success: false,
        error: "Subscription is pending approval. Please wait for super admin approval.",
      },
      { status: 403 }
    );
  }

  if (new Date(activeSubscription.expiresAt).getTime() < Date.now()) {
    activeSubscription.status = "expired";
    await activeSubscription.save();
    return NextResponse.json(
      {
        success: false,
        error: "Subscription expired. Please contact support or renew your subscription.",
      },
      { status: 403 }
    );
  }
  const sessionToken = createSessionToken({
    userId: String(user._id),
    companyId: String(user.companyId),
    userRole: user.role,
    name: user.name,
    email: user.email,
  });

  const response = NextResponse.json({
    success: true,
    data: {
      userId: user._id,
      companyId: user.companyId,
      role: user.role,
      name: user.name,
      email: user.email,
    },
  });
  response.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

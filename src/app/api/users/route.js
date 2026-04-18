import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { USER_ROLES } from "@/lib/constants";
import { incrementUsage } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();
  const users = await User.find({ companyId: auth.context.companyId })
    .select("-passwordHash")
    .sort({ createdAt: -1 });

  return apiOk(users);
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password || !role) {
    return apiError("name, email, password and role are required", 400);
  }

  if (!USER_ROLES.includes(role)) {
    return apiError("Invalid role", 400);
  }

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    limitKey: "users",
    incrementBy: 1,
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const existing = await User.findOne({
    companyId: auth.context.companyId,
    email: email.toLowerCase(),
  });
  if (existing) return apiError("User with this email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    companyId: auth.context.companyId,
    name,
    email,
    passwordHash,
    role,
  });

  await incrementUsage(auth.context.companyId, "users", 1);
  return apiOk(user, 201);
}

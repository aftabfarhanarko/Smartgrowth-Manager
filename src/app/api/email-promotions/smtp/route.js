import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailSmtpSetting from "@/models/EmailSmtpSetting";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();

  const doc = await EmailSmtpSetting.findOne({ companyId: auth.context.companyId }).lean();
  if (!doc) {
    return apiOk({
      configured: false,
      host: "",
      port: 587,
      secure: false,
      user: "",
      fromEmail: "",
      fromName: "",
    });
  }

  return apiOk({
    configured: true,
    host: doc.host,
    port: doc.port,
    secure: doc.secure,
    user: doc.user,
    fromEmail: doc.fromEmail,
    fromName: doc.fromName || "",
  });
}

export async function PUT(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const host = String(body?.host || "").trim();
  const user = String(body?.user || "").trim();
  const fromEmail = String(body?.email || body?.fromEmail || "")
    .trim()
    .toLowerCase();
  const fromName = String(body?.fromName || "").trim().slice(0, 120);
  const passwordRaw = body?.password;
  const password = passwordRaw === undefined || passwordRaw === null ? "" : String(passwordRaw);
  const port = Number(body?.port ?? 587);
  const secure = Boolean(body?.secure);

  if (!host) return apiError("host is required", 400);
  if (!user) return apiError("user is required", 400);
  if (!fromEmail) return apiError("fromEmail is required", 400);
  if (!Number.isFinite(port) || port < 1 || port > 65535) return apiError("port is invalid", 400);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const existing = await EmailSmtpSetting.findOne({ companyId: auth.context.companyId });
  if (!existing && !password.trim()) {
    return apiError("password is required for the first save", 400);
  }

  const update = {
    host,
    port,
    secure,
    user,
    fromEmail,
    fromName,
  };

  if (password.trim()) {
    update.password = password;
  }

  await EmailSmtpSetting.findOneAndUpdate(
    { companyId: auth.context.companyId },
    { $set: update, $setOnInsert: { companyId: auth.context.companyId } },
    { new: true, upsert: true }
  );

  return apiOk({ saved: true });
}

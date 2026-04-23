import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailPromotionTemplate from "@/models/EmailPromotionTemplate";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const templates = await EmailPromotionTemplate.find({ companyId: auth.context.companyId })
    .sort({ createdAt: -1 })
    .lean();

  return apiOk({ templates });
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 120);
  const subject = String(body?.subject || "").trim().slice(0, 200);
  const bodyMode = body?.bodyMode === "html" ? "html" : "text";
  const bodyText = String(body?.bodyText || "").trim().slice(0, 20000);
  const templateLink = String(body?.templateLink || "").trim().slice(0, 2000);
  const footerText = String(body?.footerText || "").trim().slice(0, 500);

  if (!name) return apiError("name is required", 400);
  if (!subject) return apiError("subject is required", 400);
  if (!bodyText) return apiError("bodyText is required", 400);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const template = await EmailPromotionTemplate.create({
    companyId: auth.context.companyId,
    name,
    subject,
    bodyMode,
    bodyText,
    templateLink,
    footerText,
  });

  return apiOk({ template });
}

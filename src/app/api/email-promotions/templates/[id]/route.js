import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailPromotionTemplate from "@/models/EmailPromotionTemplate";

export async function PUT(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  if (!id) return apiError("template id is required", 400);

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

  const template = await EmailPromotionTemplate.findOneAndUpdate(
    { _id: id, companyId: auth.context.companyId },
    { $set: { name, subject, bodyMode, bodyText, templateLink, footerText } },
    { new: true }
  );

  if (!template) return apiError("Template not found", 404);

  return apiOk({ template });
}

export async function DELETE(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  if (!id) return apiError("template id is required", 400);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const deleted = await EmailPromotionTemplate.findOneAndDelete({
    _id: id,
    companyId: auth.context.companyId,
  });
  if (!deleted) return apiError("Template not found", 404);

  return apiOk({ deleted: true });
}

import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailSmtpSetting from "@/models/EmailSmtpSetting";
import { sendPromoEmail } from "@/lib/email/sendPromoEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const testEmail = String(body?.testEmail || body?.to || "")
    .trim()
    .toLowerCase();

  if (!testEmail || !EMAIL_RE.test(testEmail)) {
    return apiError("testEmail must be a valid email", 400);
  }

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const settings = await EmailSmtpSetting.findOne({ companyId: auth.context.companyId });
  if (!settings) return apiError("SMTP settings not configured", 400);

  try {
    await sendPromoEmail({
      settings,
      to: testEmail,
      subject: "Smart Delivery — SMTP test",
      text: "Your SMTP settings are working.",
      html: "<p>Your SMTP settings are working.</p>",
      attachmentPublicPath: "",
    });
  } catch (error) {
    return apiError(error?.message || "SMTP test failed", 400);
  }

  return apiOk({ ok: true });
}

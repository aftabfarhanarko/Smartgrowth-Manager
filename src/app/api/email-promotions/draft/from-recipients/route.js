import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailPromotionDraft from "@/models/EmailPromotionDraft";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const recipients = Array.isArray(body?.recipients) ? body.recipients : [];

  if (!recipients.length) return apiError("recipients is required", 400);
  if (recipients.length > 5000) return apiError("recipients too large (max 5000)", 400);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const cleaned = [];
  for (const r of recipients) {
    const email = normalizeEmail(r?.email);
    const name = String(r?.name || "").trim().slice(0, 120);
    if (!email || !EMAIL_RE.test(email)) continue;
    cleaned.push({ name, email });
  }

  if (!cleaned.length) return apiError("No valid recipients (email missing)", 400);

  const draft = await EmailPromotionDraft.create({
    companyId: auth.context.companyId,
    recipients: cleaned,
  });

  return apiOk({
    draftId: draft._id,
    recipientsCount: cleaned.length,
  });
}

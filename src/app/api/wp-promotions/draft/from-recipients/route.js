import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import WpPromotionDraft from "@/models/WpPromotionDraft";
import { normalizePhoneDigits } from "@/lib/wp/phone";

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
    featureKey: "wp_promotion",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const cleaned = [];
  for (const r of recipients) {
    const phone = normalizePhoneDigits(r?.phone);
    const name = String(r?.name || "").trim().slice(0, 120);
    if (!phone) continue;
    cleaned.push({ name, phone });
  }

  if (!cleaned.length) return apiError("No valid recipients (phone missing)", 400);

  const draft = await WpPromotionDraft.create({
    companyId: auth.context.companyId,
    // campaignId is optional for Excel/bulk import.
    // Leave it undefined to avoid schema validation issues.
    recipients: cleaned,
  });

  return apiOk({
    draftId: draft._id,
    recipientsCount: cleaned.length,
  });
}


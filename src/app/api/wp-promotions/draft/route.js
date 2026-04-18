import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import CampaignLead from "@/models/CampaignLead";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import WpPromotionDraft from "@/models/WpPromotionDraft";

function normalizeSpace(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function findAnswerValue(answers = {}, field) {
  if (!field) return "";
  const baseKey = normalizeSpace(field.label) || String(field.key || "");
  if (!baseKey) return "";

  // Exact match.
  if (Object.prototype.hasOwnProperty.call(answers, baseKey)) {
    return answers[baseKey];
  }

  // Duplicate-label case: answerKey might be like `${base} (2)`.
  const keys = Object.keys(answers);
  const matchedKey = keys.find((k) => k === baseKey || k.startsWith(`${baseKey} `) || k.startsWith(`${baseKey}(`));
  if (matchedKey) return answers[matchedKey];

  // Fallback: sometimes key is stored as field.key.
  if (field.key && Object.prototype.hasOwnProperty.call(answers, field.key)) return answers[field.key];

  return "";
}

function coerceString(value) {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function sanitizePhoneDigits(value) {
  // For WA deep-link you need digits; country code should be included in the original input.
  return String(value || "").replace(/[^\d]/g, "");
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const { campaignId, leadIds } = body || {};

  if (!campaignId) return apiError("campaignId is required", 400);
  if (!Array.isArray(leadIds) || leadIds.length === 0) return apiError("leadIds is required", 400);
  if (leadIds.length > 5000) return apiError("leadIds too large (max 5000)", 400);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "wp_promotion",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId: auth.context.companyId,
  });

  if (!campaign) return apiError("Campaign not found", 404);

  const phoneField =
    (campaign.fields || []).find((f) => f.type === "phone") ||
    (campaign.fields || []).find((f) => /phone/i.test(String(f.label || f.key || ""))) ||
    null;

  const nameField =
    (campaign.fields || []).find((f) => String(f.type) === "text" && /name/i.test(String(f.label || f.key || ""))) ||
    (campaign.fields || []).find((f) => String(f.type) === "text") ||
    null;

  if (!phoneField) return apiError("No phone field found in campaign", 400);
  if (!nameField) return apiError("No name field found in campaign", 400);

  const leads = await CampaignLead.find({
    _id: { $in: leadIds },
    campaignId: campaign._id,
    companyId: auth.context.companyId,
  });

  if (!leads || leads.length === 0) return apiError("No leads found", 404);

  const recipients = [];
  let skipped = 0;

  for (const lead of leads) {
    const answers = lead?.answers || {};
    const phoneRaw = coerceString(findAnswerValue(answers, phoneField));
    const phone = sanitizePhoneDigits(phoneRaw);
    const name = coerceString(findAnswerValue(answers, nameField)).slice(0, 120);

    if (!phone) {
      skipped += 1;
      continue;
    }

    recipients.push({
      leadId: lead._id,
      name,
      phone,
    });
  }

  if (!recipients.length) return apiError("No valid recipients (phone missing)", 400);

  const draft = await WpPromotionDraft.create({
    companyId: auth.context.companyId,
    campaignId: campaign._id,
    recipients,
  });

  return apiOk({
    draftId: draft._id,
    recipientsCount: recipients.length,
    skipped,
  });
}


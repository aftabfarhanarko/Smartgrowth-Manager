import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import CampaignLead from "@/models/CampaignLead";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailPromotionDraft from "@/models/EmailPromotionDraft";

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

  if (Object.prototype.hasOwnProperty.call(answers, baseKey)) {
    return answers[baseKey];
  }

  const keys = Object.keys(answers);
  const matchedKey = keys.find((k) => k === baseKey || k.startsWith(`${baseKey} `) || k.startsWith(`${baseKey}(`));
  if (matchedKey) return answers[matchedKey];

  if (field.key && Object.prototype.hasOwnProperty.call(answers, field.key)) return answers[field.key];

  return "";
}

function coerceString(value) {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

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
  const { campaignId, leadIds } = body || {};

  if (!campaignId) return apiError("campaignId is required", 400);
  if (!Array.isArray(leadIds) || leadIds.length === 0) return apiError("leadIds is required", 400);
  if (leadIds.length > 5000) return apiError("leadIds too large (max 5000)", 400);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId: auth.context.companyId,
  });

  if (!campaign) return apiError("Campaign not found", 404);

  const emailField =
    (campaign.fields || []).find((f) => f.type === "email") ||
    (campaign.fields || []).find((f) => /email/i.test(String(f.label || f.key || ""))) ||
    null;

  const nameField =
    (campaign.fields || []).find((f) => String(f.type) === "text" && /name/i.test(String(f.label || f.key || ""))) ||
    (campaign.fields || []).find((f) => String(f.type) === "text") ||
    null;

  if (!emailField) return apiError("No email field found in campaign", 400);
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
    const emailRaw = normalizeEmail(coerceString(findAnswerValue(answers, emailField)));
    const name = coerceString(findAnswerValue(answers, nameField)).slice(0, 120);

    if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
      skipped += 1;
      continue;
    }

    recipients.push({
      leadId: lead._id,
      name,
      email: emailRaw,
    });
  }

  if (!recipients.length) return apiError("No valid recipients (email missing or invalid)", 400);

  const draft = await EmailPromotionDraft.create({
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

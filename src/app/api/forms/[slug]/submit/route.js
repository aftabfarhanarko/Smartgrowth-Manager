import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import CampaignLead from "@/models/CampaignLead";
import { assertSubscriptionAccess } from "@/lib/guards";
import { incrementUsage } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";

function validateAnswers(campaignFields, answers) {
  const errors = [];
  const cleaned = {};
  const usedKeys = new Set();

  function makeAnswerKey(label, fallbackKey) {
    const base =
      String(label || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80) || fallbackKey;

    let key = base;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${base} (${suffix})`;
      suffix += 1;
    }
    usedKeys.add(key);
    return key;
  }

  campaignFields.forEach((field) => {
    const incoming = answers?.[field.key];
    const value =
      field.type === "checkbox" && Array.isArray(incoming)
        ? incoming.map((item) => String(item || "").trim()).filter(Boolean)
        : String(incoming || "").trim();

    if (field.required) {
      const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
      if (isEmpty) {
        errors.push(`${field.label} is required`);
      }
    }

    if (field.type === "email" && value && !Array.isArray(value)) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!emailOk) {
        errors.push(`${field.label} must be a valid email`);
      }
    }

    if (field.type === "phone" && value && !Array.isArray(value)) {
      const phoneOk = /^[0-9+\-() ]{6,20}$/.test(value);
      if (!phoneOk) {
        errors.push(`${field.label} must be a valid phone`);
      }
    }

    const answerKey = makeAnswerKey(field.label, field.key);
    cleaned[answerKey] = value;
  });

  return { errors, cleaned };
}

export async function POST(request, { params }) {
  const { slug } = await params;
  if (!slug) return apiError("Form slug is required", 400);

  const body = await request.json();
  await connectDB();

  const campaign = await Campaign.findOne({ slug, status: "active" });
  if (!campaign) return apiError("Form not found", 404);

  const access = await assertSubscriptionAccess({
    companyId: campaign.companyId,
    limitKey: "users",
    incrementBy: 1,
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const { errors, cleaned } = validateAnswers(campaign.fields || [], body?.answers || {});
  if (errors.length) {
    return apiError(errors[0], 400);
  }

  const lead = await CampaignLead.create({
    companyId: campaign.companyId,
    campaignId: campaign._id,
    answers: cleaned,
    submittedAt: new Date(),
  });

  await incrementUsage(campaign.companyId, "users", 1);

  return apiOk(
    {
      submitted: true,
      leadId: lead._id,
      campaignId: campaign._id,
    },
    201
  );
}

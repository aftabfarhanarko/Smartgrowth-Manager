import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import CampaignLead from "@/models/CampaignLead";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return apiError("Invalid campaign id", 400);
  }

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const campaign = await Campaign.findOne({
    _id: id,
    companyId: auth.context.companyId,
  });
  if (!campaign) return apiError("Campaign not found", 404);

  const leads = await CampaignLead.find({
    campaignId: campaign._id,
    companyId: auth.context.companyId,
  }).sort({ submittedAt: -1 });

  const keyToLabelMap = new Map();
  (campaign.fields || []).forEach((field) => {
    const fieldKey = String(field?.key || "").trim();
    const fieldLabel = String(field?.label || "").trim();
    if (fieldKey && fieldLabel) {
      keyToLabelMap.set(fieldKey, fieldLabel);
    }
  });

  const normalizedLeads = leads.map((leadDoc) => {
    const lead = leadDoc.toObject();
    const answers = lead?.answers || {};
    const normalizedAnswers = {};

    Object.entries(answers).forEach(([key, value]) => {
      const labelKey = keyToLabelMap.get(key) || key;
      if (normalizedAnswers[labelKey] === undefined) {
        normalizedAnswers[labelKey] = value;
        return;
      }

      // Preserve both values if a mapped label already exists.
      normalizedAnswers[`${labelKey} (${key})`] = value;
    });

    return {
      ...lead,
      answers: normalizedAnswers,
    };
  });

  return apiOk({
    campaign,
    count: normalizedLeads.length,
    leads: normalizedLeads,
  });
}

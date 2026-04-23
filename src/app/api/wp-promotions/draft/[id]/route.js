import connectDB from "@/lib/mongodb";
import WpPromotionDraft from "@/models/WpPromotionDraft";
import Campaign from "@/models/Campaign";
import { assertTenantContext } from "@/lib/auth-context";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  if (!id) return apiError("draft id is required", 400);

  await connectDB();

  const draft = await WpPromotionDraft.findOne({
    _id: id,
    companyId: auth.context.companyId,
  });

  if (!draft) return apiError("Draft not found", 404);

  // Optional extra info for UI: campaign name.
  const campaign = await Campaign.findOne({ _id: draft.campaignId, companyId: auth.context.companyId });

  return apiOk({
    draftId: draft._id,
    campaignName: campaign?.name || "",
    recipients: draft.recipients || [],
    recipientsCount: (draft.recipients || []).length,
  });
}


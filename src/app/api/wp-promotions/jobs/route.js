import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import WpPromotionDraft from "@/models/WpPromotionDraft";
import WpPromotionJob from "@/models/WpPromotionJob";

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const { draftId, templateText, templateLink, intervalSeconds } = body || {};

  if (!draftId) return apiError("draftId is required", 400);
  if (!templateText || !String(templateText).trim()) return apiError("templateText is required", 400);

  await connectDB();

  const draft = await WpPromotionDraft.findOne({
    _id: draftId,
    companyId: auth.context.companyId,
  });

  if (!draft) return apiError("Draft not found", 404);

  const interval = Number(intervalSeconds || 30);
  if (!Number.isFinite(interval) || interval < 10) return apiError("intervalSeconds is invalid", 400);

  // Ensure feature exists; limits are checked per-message when running.
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "wp_promotion",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const job = await WpPromotionJob.create({
    companyId: auth.context.companyId,
    draftId: draft._id,
    recipients: draft.recipients || [],
    templateText: String(templateText).slice(0, 2000),
    templateLink: String(templateLink || "").trim().slice(0, 2000),
    intervalSeconds: interval,
    status: "running",
    currentIndex: 0,
    sentCount: 0,
    nextRunAt: new Date(Date.now() + interval * 1000),
    lastError: "",
  });

  return apiOk({ jobId: job._id });
}


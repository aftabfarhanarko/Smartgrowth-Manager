import fs from "fs";
import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";
import EmailPromotionDraft from "@/models/EmailPromotionDraft";
import EmailPromotionJob from "@/models/EmailPromotionJob";
import { isSafeEmailAttachmentPath, publicPathToAbsolute } from "@/lib/email/attachmentPath";

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const { draftId, subject, bodyText, bodyMode, templateLink, footerText, intervalSeconds, attachmentPublicPath } =
    body || {};

  if (!draftId) return apiError("draftId is required", 400);
  if (!subject || !String(subject).trim()) return apiError("subject is required", 400);
  if (!bodyText || !String(bodyText).trim()) return apiError("bodyText is required", 400);

  await connectDB();

  const draft = await EmailPromotionDraft.findOne({
    _id: draftId,
    companyId: auth.context.companyId,
  });

  if (!draft) return apiError("Draft not found", 404);

  const interval = Number(intervalSeconds || 5);
  if (!Number.isFinite(interval) || interval < 5) return apiError("intervalSeconds is invalid", 400);

  let attachment = "";
  if (attachmentPublicPath && String(attachmentPublicPath).trim()) {
    attachment = String(attachmentPublicPath).trim();
    if (!isSafeEmailAttachmentPath(auth.context.companyId, attachment)) {
      return apiError("Invalid attachment path", 400);
    }
    const abs = publicPathToAbsolute(attachment);
    if (!fs.existsSync(abs)) {
      return apiError("Attachment file not found", 400);
    }
  }

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const job = await EmailPromotionJob.create({
    companyId: auth.context.companyId,
    draftId: draft._id,
    recipients: draft.recipients || [],
    subject: String(subject).slice(0, 200),
    bodyMode: bodyMode === "html" ? "html" : "text",
    bodyText: String(bodyText).slice(0, 20000),
    templateLink: String(templateLink || "").trim().slice(0, 2000),
    footerText: String(footerText || "").trim().slice(0, 500),
    attachmentPublicPath: attachment,
    intervalSeconds: interval,
    status: "running",
    currentIndex: 0,
    sentCount: 0,
    nextRunAt: new Date(Date.now() + interval * 1000),
    lastError: "",
  });

  return apiOk({ jobId: job._id });
}

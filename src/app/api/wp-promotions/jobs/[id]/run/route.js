import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { incrementUsage } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";
import WpPromotionJob from "@/models/WpPromotionJob";
import { sendWhatsAppMessage } from "@/lib/wp/sendWhatsApp";

function applyTemplate({ templateText, templateLink, name }) {
  let message = String(templateText || "");
  const link = String(templateLink || "");

  message = message.replaceAll("{{name}}", String(name || ""));
  message = message.replaceAll("{{link}}", link);

  // If user provided link but didn't include placeholder, append at the end.
  if (link && !message.includes(link)) {
    message = `${message}\n\n${link}`;
  }

  return message.trim();
}

export async function POST(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  if (!id) return apiError("job id is required", 400);

  await connectDB();

  const job = await WpPromotionJob.findOne({ _id: id, companyId: auth.context.companyId });
  if (!job) return apiError("Job not found", 404);

  if (job.status !== "running") {
    return apiOk({
      status: job.status,
      currentIndex: job.currentIndex,
      sentCount: job.sentCount,
      total: (job.recipients || []).length,
      lastError: job.lastError,
      lastWaLink: job.lastWaLink,
    });
  }

  const now = new Date();
  if (job.nextRunAt && now.getTime() < job.nextRunAt.getTime()) {
    return apiOk({
      status: "waiting",
      currentIndex: job.currentIndex,
      sentCount: job.sentCount,
      total: (job.recipients || []).length,
      nextRunAt: job.nextRunAt,
    });
  }

  const recipients = job.recipients || [];
  if (job.currentIndex >= recipients.length) {
    job.status = "completed";
    job.nextRunAt = null;
    await job.save();

    return apiOk({
      status: "completed",
      currentIndex: job.currentIndex,
      sentCount: job.sentCount,
      total: recipients.length,
      lastError: job.lastError,
      lastWaLink: job.lastWaLink,
    });
  }

  const recipientIndex = job.currentIndex;
  const recipient = recipients[recipientIndex];
  const message = applyTemplate({
    templateText: job.templateText,
    templateLink: job.templateLink,
    name: recipient?.name,
  });

  // Enforce usage limit per-message.
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "wp_promotion",
    limitKey: "wp_promotions_per_month",
    incrementBy: 1,
  });
  if (access.error) {
    job.status = "failed";
    job.lastError = access.error;
    const logEntry = {
      index: recipientIndex,
      name: recipient?.name || "",
      phone: recipient?.phone,
      status: "failed",
      waLink: "",
      error: access.error,
      sentAt: now,
    };
    job.sendLogs = Array.isArray(job.sendLogs) ? job.sendLogs : [];
    job.sendLogs.push(logEntry);
    await job.save();
    return apiOk({
      status: "failed",
      currentIndex: job.currentIndex,
      sentCount: job.sentCount,
      total: recipients.length,
      lastError: job.lastError,
      lastWaLink: job.lastWaLink,
      lastLog: logEntry,
    });
  }

  try {
    const sendResult = await sendWhatsAppMessage({
      phone: recipient?.phone,
      message,
      clientKey: auth.context.companyId,
    });

    // Handle "initializing" status from the sender
    if (sendResult?.status === "initializing") {
      job.status = "running";
      job.lastError = sendResult.error;
      // Retry very soon (5 seconds)
      job.nextRunAt = new Date(now.getTime() + 5000);
      await job.save();
      return apiOk({
        status: "running",
        currentIndex: job.currentIndex,
        sentCount: job.sentCount,
        total: recipients.length,
        nextRunAt: job.nextRunAt,
        lastError: job.lastError,
      });
    }

    // Count it as "used" if it was queued successfully.
    if (sendResult?.queued) {
      await incrementUsage(auth.context.companyId, "wpPromotions", 1);
    } else {
      throw new Error(sendResult?.error || "WhatsApp send failed");
    }

    job.sentCount += 1;
    job.currentIndex += 1;
    job.lastError = "";
    job.lastWaLink = sendResult?.waLink || "";

    job.lastRunAt = now;
    const baseInterval = Number(job.intervalSeconds || 5);
    const isBreakPoint = job.sentCount > 0 && job.sentCount % 10 === 0;
    
    // If 10 messages sent, wait 30 seconds. Otherwise wait baseInterval (5s).
    const waitSeconds = isBreakPoint ? 30 : baseInterval;
    job.nextRunAt = new Date(now.getTime() + waitSeconds * 1000);

    const logEntry = {
      index: recipientIndex,
      name: recipient?.name || "",
      phone: recipient?.phone,
      status: "queued",
      waLink: sendResult?.waLink || "",
      error: "",
      sentAt: now,
    };
    job.sendLogs = Array.isArray(job.sendLogs) ? job.sendLogs : [];
    job.sendLogs.push(logEntry);
    if (job.sendLogs.length > 100) job.sendLogs = job.sendLogs.slice(job.sendLogs.length - 100);

    // If this was the last recipient, complete.
    if (job.currentIndex >= recipients.length) {
      job.status = "completed";
      job.nextRunAt = null;
    }

    await job.save();

    return apiOk({
      status: job.status,
      currentIndex: job.currentIndex,
      sentCount: job.sentCount,
      total: recipients.length,
      nextRunAt: job.nextRunAt,
      lastWaLink: job.lastWaLink,
      lastLog: logEntry,
    });
  } catch (error) {
    // If a single message fails, log it and MOVE TO NEXT recipient instead of stopping the whole job
    console.error(`[Job] Message failed for index ${recipientIndex}:`, error.message);
    
    job.currentIndex += 1;
    job.lastError = error?.message || "Send failed";
    
    const logEntry = {
      index: recipientIndex,
      name: recipient?.name || "",
      phone: recipient?.phone,
      status: "failed",
      waLink: "",
      error: error?.message || "Send failed",
      sentAt: now,
    };
    job.sendLogs = Array.isArray(job.sendLogs) ? job.sendLogs : [];
    job.sendLogs.push(logEntry);
    if (job.sendLogs.length > 100) job.sendLogs = job.sendLogs.slice(job.sendLogs.length - 100);

    // Schedule next run even on failure
    const baseInterval = Number(job.intervalSeconds || 5);
    job.nextRunAt = new Date(now.getTime() + baseInterval * 1000);

    // If this was the last recipient, complete. Otherwise keep 'running'
    if (job.currentIndex >= recipients.length) {
      job.status = "completed";
      job.nextRunAt = null;
    } else {
      job.status = "running";
    }

    await job.save();

    return apiOk({
      status: job.status,
      currentIndex: job.currentIndex,
      sentCount: job.sentCount,
      total: recipients.length,
      nextRunAt: job.nextRunAt,
      lastError: job.lastError,
      lastLog: logEntry,
    });
  }
}


import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";

function makeSlugBase(value = "") {
  return (
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "form"
  );
}

function normalizeRedirectUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) return raw;
    return parsed.toString();
  } catch {
    return raw;
  }
}

function normalizeFields(fields = []) {
  return fields
    .map((field, index) => {
      const label = String(field?.label || "").trim();
      const key =
        String(field?.key || "")
          .trim()
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .toLowerCase() || `field_${index + 1}`;
      const type = String(field?.type || "text");
      const options = Array.isArray(field?.options)
        ? field.options.map((o) => String(o || "").trim()).filter(Boolean)
        : [];
      return {
        key,
        label,
        type,
        required: Boolean(field?.required),
        options,
      };
    })
    .filter((field) => field.label);
}

function sanitizeHexColor(value, fallback) {
  const color = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return fallback;
}

function normalizeDesign(design) {
  return {
    brandColor: sanitizeHexColor(design?.brandColor, "#18181b"),
    pageBgColor: sanitizeHexColor(design?.pageBgColor, "#f4f4f5"),
    cardBgColor: sanitizeHexColor(design?.cardBgColor, "#ffffff"),
    titleColor: sanitizeHexColor(design?.titleColor, "#18181b"),
    descriptionColor: sanitizeHexColor(design?.descriptionColor, "#71717a"),
    inputBgColor: sanitizeHexColor(design?.inputBgColor, "#ffffff"),
    inputBorderColor: sanitizeHexColor(design?.inputBorderColor, "#e4e4e7"),
    buttonTextColor: sanitizeHexColor(design?.buttonTextColor, "#ffffff"),
    borderRadius: Number.isInteger(design?.borderRadius) ? design.borderRadius : 12,
    headerImageUrl: String(design?.headerImageUrl || "").trim(),
    fontFamily: String(design?.fontFamily || "Inter").trim().slice(0, 40) || "Inter",
    submitButtonText: String(design?.submitButtonText || "Submit").trim().slice(0, 60) || "Submit",
    successMessage:
      String(
        design?.successMessage || "Thank you! Your response has been submitted."
      )
        .trim()
        .slice(0, 240) || "Thank you! Your response has been submitted.",
  };
}

async function makeUniqueSlugForUpdate(baseSource, companyId, currentId) {
  const base = makeSlugBase(baseSource);
  let slug = base;
  let attempts = 0;

  while (
    (await Campaign.exists({
      companyId,
      _id: { $ne: currentId },
      slug,
    })) &&
    attempts < 12
  ) {
    attempts += 1;
    slug = `${base}-${attempts}`;
  }

  return slug;
}

export async function PATCH(request, { params }) {
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

  const body = await request.json();

  // name / slug
  if (body?.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return apiError("Campaign name is required", 400);
    campaign.name = name;
    campaign.slug = await makeUniqueSlugForUpdate(name, auth.context.companyId, campaign._id);
  }

  // description
  if (body?.description !== undefined) {
    campaign.description = String(body.description || "").trim();
  }

  // status
  if (body?.status !== undefined) {
    const status = body.status;
    if (!["draft", "active", "closed"].includes(status)) {
      return apiError("Invalid status value", 400);
    }
    campaign.status = status;
  }

  // redirectUrl
  if (body?.redirectUrl !== undefined) {
    campaign.redirectUrl = normalizeRedirectUrl(body.redirectUrl);
  }

  // fields
  if (body?.fields !== undefined) {
    const fields = normalizeFields(body.fields || []);
    if (!fields.length) return apiError("At least one form field is required", 400);
    campaign.fields = fields;
  }

  // design
  if (body?.design !== undefined) {
    const existing = campaign.design?.toObject ? campaign.design.toObject() : campaign.design || {};
    campaign.design = normalizeDesign({ ...existing, ...body.design });
  }

  await campaign.save();
  const updated = campaign.toObject();
  return apiOk({
    ...updated,
    redirectUrl: updated.redirectUrl || "",
  });
}

export async function DELETE(request, { params }) {
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

  const deleted = await Campaign.findOneAndDelete({
    _id: id,
    companyId: auth.context.companyId,
  });
  if (!deleted) return apiError("Campaign not found", 404);

  return apiOk({ deleted: true });
}

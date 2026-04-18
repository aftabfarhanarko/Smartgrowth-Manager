"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const FIELD_TYPES = ["text", "phone", "email", "textarea", "select", "radio", "checkbox"];
const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Lato",
];

function makeEmptyField(index = 0) {
  return {
    id: `field-${Date.now()}-${index}`,
    label: "",
    key: "",
    type: "text",
    required: false,
    optionsText: "",
  };
}

export default function DashboardCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("#18181b");
  const [pageBgColor, setPageBgColor] = useState("#f4f4f5");
  const [cardBgColor, setCardBgColor] = useState("#ffffff");
  const [titleColor, setTitleColor] = useState("#18181b");
  const [descriptionColor, setDescriptionColor] = useState("#71717a");
  const [inputBgColor, setInputBgColor] = useState("#ffffff");
  const [inputBorderColor, setInputBorderColor] = useState("#e4e4e7");
  const [buttonTextColor, setButtonTextColor] = useState("#ffffff");
  const [borderRadius, setBorderRadius] = useState(12);
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [submitButtonText, setSubmitButtonText] = useState("Submit");
  const [successMessage, setSuccessMessage] = useState(
    "Thank you! Your response has been submitted."
  );
  const [fields, setFields] = useState([makeEmptyField(1)]);
  const [origin, setOrigin] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    const response = await fetch("/api/campaigns", { headers: getCustomerHeaders() });
    const json = await response.json();

    if (!response.ok) {
      setError(json?.error || "Failed to load campaigns");
      setLoading(false);
      return;
    }

    setCampaigns(Array.isArray(json?.data) ? json.data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadCampaigns().catch(() => {
      setError("Failed to load campaigns");
      setLoading(false);
    });
  }, []);

  const previewFields = useMemo(
    () => fields.filter((field) => String(field.label || "").trim()),
    [fields]
  );

  function addField() {
    setFields((state) => [...state, makeEmptyField(state.length + 1)]);
  }

  function updateField(id, patch) {
    setFields((state) => state.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function removeField(id) {
    setFields((state) => (state.length <= 1 ? state : state.filter((field) => field.id !== id)));
  }

  async function handleCreateCampaign(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    const normalizedFields = fields
      .map((field) => ({
        key: String(field.key || "")
          .trim()
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .toLowerCase(),
        label: String(field.label || "").trim(),
        type: field.type,
        required: Boolean(field.required),
        options: String(field.optionsText || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }))
      .filter((field) => field.label);

    if (!normalizedFields.length) {
      setError("At least one field is required");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: getCustomerHeaders(),
      body: JSON.stringify({
        name,
        description,
        status: "active",
        redirectUrl: String(redirectUrl || "").trim(),
        fields: normalizedFields,
        design: {
          brandColor,
          pageBgColor,
          cardBgColor,
          titleColor,
          descriptionColor,
          inputBgColor,
          inputBorderColor,
          buttonTextColor,
          borderRadius: parseInt(borderRadius, 10) || 0,
          headerImageUrl,
          fontFamily,
          submitButtonText,
          successMessage,
        },
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json?.error || "Failed to create campaign");
      setSubmitting(false);
      return;
    }

    setMessage("Campaign form created successfully.");
    setName("");
    setDescription("");
    setBrandColor("#18181b");

    setPageBgColor("#f4f4f5");
    setCardBgColor("#ffffff");
    setSubmitButtonText("Submit");
    setSuccessMessage("Thank you! Your response has been submitted.");
    setFields([makeEmptyField(1)]);
    setRedirectUrl("");
    setSubmitting(false);
    await loadCampaigns();
  }

  async function handleDeleteCampaign(campaignId) {
    const confirmed = window.confirm("Are you sure you want to delete this campaign?");
    if (!confirmed) return;

    setDeletingId(campaignId);
    setMessage("");
    setError("");

    const response = await fetch(`/api/campaigns/${campaignId}`, {
      method: "DELETE",
      headers: getCustomerHeaders(),
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json?.error || "Failed to delete campaign");
      setDeletingId("");
      return;
    }

    setCampaigns((state) => state.filter((campaign) => campaign._id !== campaignId));
    setMessage("Campaign deleted successfully.");
    setDeletingId("");
  }

  return (
    <CustomerDashboardShell title="Campaigns">
      {message && <p className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleCreateCampaign} className="rounded border p-4">
        <h2 className="text-lg font-semibold">Create Dynamic Form</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Build Google Form style campaign form and share the URL.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className="rounded border p-2"
            placeholder="Campaign name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <input
            className="rounded border p-2"
            placeholder="After submit redirect link (https://...)"
            value={redirectUrl}
            onChange={(event) => setRedirectUrl(event.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-4 rounded border bg-zinc-50/50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Form UI Designer
          </h3>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Header Image URL (Optional banner)
                <input
                  className="rounded border p-2 text-sm"
                  placeholder="https://example.com/banner.jpg"
                  value={headerImageUrl}
                  onChange={(event) => setHeaderImageUrl(event.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Font Family
              <select
                className="rounded border p-2 text-sm"
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Corner Roundness ({borderRadius}px)
              <input
                type="range"
                min="0"
                max="40"
                className="h-10"
                value={borderRadius}
                onChange={(event) => setBorderRadius(parseInt(event.target.value, 10))}
              />
            </label>

            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Submit Button Text
              <input
                className="rounded border p-2 text-sm"
                value={submitButtonText}
                onChange={(event) => setSubmitButtonText(event.target.value)}
              />
            </label>
          </div>

          <hr className="my-1 border-zinc-200" />

          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Primary (Button) Color
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={brandColor}
                onChange={(event) => setBrandColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Button Text Color
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={buttonTextColor}
                onChange={(event) => setButtonTextColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Page Background
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={pageBgColor}
                onChange={(event) => setPageBgColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Card Background
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={cardBgColor}
                onChange={(event) => setCardBgColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Title Text Color
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={titleColor}
                onChange={(event) => setTitleColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Description Color
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={descriptionColor}
                onChange={(event) => setDescriptionColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Field Background
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={inputBgColor}
                onChange={(event) => setInputBgColor(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Field Border Color
              <input
                type="color"
                className="h-10 w-full rounded border p-1"
                value={inputBorderColor}
                onChange={(event) => setInputBorderColor(event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-1 text-xs font-medium text-zinc-600">
            Success Message after submit
            <input
              className="rounded border p-2 text-sm"
              placeholder="e.g. Thanks for joining!"
              value={successMessage}
              onChange={(event) => setSuccessMessage(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {fields.map((field) => (
            <div key={field.id} className="rounded border p-3">
              <div className="grid gap-2 md:grid-cols-4">
                <input
                  className="rounded border p-2"
                  placeholder="Field label"
                  value={field.label}
                  onChange={(event) => updateField(field.id, { label: event.target.value })}
                  required
                />
                <input
                  className="rounded border p-2"
                  placeholder="Field key (optional)"
                  value={field.key}
                  onChange={(event) => updateField(field.id, { key: event.target.value })}
                />
                <select
                  className="rounded border p-2"
                  value={field.type}
                  onChange={(event) => updateField(field.id, { type: event.target.value })}
                >
                  {FIELD_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 rounded border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => updateField(field.id, { required: event.target.checked })}
                  />
                  Required
                </label>
              </div>

              {["select", "radio", "checkbox"].includes(field.type) ? (
                <input
                  className="mt-2 w-full rounded border p-2"
                  placeholder="Options separated by comma (e.g. Dhaka, Chittagong)"
                  value={field.optionsText}
                  onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                />
              ) : null}

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="rounded border border-red-200 px-3 py-1 text-xs text-red-700"
                  onClick={() => removeField(field.id)}
                >
                  Remove Field
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={addField} className="rounded border px-3 py-2 text-sm">
            Add Field
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Campaign Form"}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Campaign Forms</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading campaigns...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[780px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Status</th>
                  <th className="border p-2">Fields</th>
                  <th className="border p-2">Redirect URL</th>
                  <th className="border p-2">Share URL</th>
                  <th className="border p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const sharePath = `/f/${campaign.slug}`;
                  const shareUrl = origin ? `${origin}${sharePath}` : sharePath;

                  return (
                    <tr key={campaign._id}>
                      <td className="border p-2">{campaign.name}</td>
                      <td className="border p-2 capitalize">{campaign.status}</td>
                      <td className="border p-2">{Array.isArray(campaign.fields) ? campaign.fields.length : 0}</td>
                      <td className="border p-2">
                        {campaign.redirectUrl ? (
                          <a
                            href={campaign.redirectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {campaign.redirectUrl}
                          </a>
                        ) : (
                          <span className="text-zinc-400">None</span>
                        )}
                      </td>
                      <td className="border p-2">
                        <a className="text-blue-700 underline" href={sharePath} target="_blank" rel="noreferrer">
                          {shareUrl}
                        </a>
                      </td>
                      <td className="border p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/leads?campaignId=${campaign._id}`}
                            className="rounded border px-3 py-1 text-xs"
                          >
                            View Leads
                          </Link>
                          <button
                            type="button"
                            className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 disabled:opacity-60"
                            disabled={deletingId === campaign._id}
                            onClick={() => handleDeleteCampaign(campaign._id)}
                          >
                            {deletingId === campaign._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Real-time Visual Preview
          </div>
          <div className="p-8" style={{ backgroundColor: pageBgColor, fontFamily: fontFamily }}>
            <div
              className="mx-auto w-full max-w-lg overflow-hidden shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: cardBgColor,
                borderRadius: `${borderRadius}px`,
              }}
            >
              {headerImageUrl && (
                <img
                  src={headerImageUrl}
                  alt="Banner"
                  className="h-32 w-full object-cover"
                  onError={(e) => (e.target.style.display = "none")}
                />
              )}
              <div className="p-6">
                <h1 className="text-2xl font-bold" style={{ color: titleColor }}>
                  {name || "Campaign Title"}
                </h1>
                {description && (
                  <p className="mt-2 text-sm" style={{ color: descriptionColor }}>
                    {description}
                  </p>
                )}

                <div className="mt-6 space-y-4">
                  {previewFields.length === 0 ? (
                    <p className="py-10 text-center text-xs text-zinc-400">
                      Add some fields to see them here...
                    </p>
                  ) : (
                    previewFields.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <div
                          className="w-full border p-2 text-sm text-zinc-500"
                          style={{
                            backgroundColor: inputBgColor,
                            borderColor: inputBorderColor,
                            borderRadius: `${borderRadius / 2}px`,
                          }}
                        >
                          {field.type === "select"
                            ? "Select an option..."
                            : field.type === "textarea"
                            ? "Enter your message..."
                            : `Enter ${field.label.toLowerCase()}...`}
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    disabled
                    className="mt-4 w-full py-2.5 text-sm font-bold shadow-sm transition-all"
                    style={{
                      backgroundColor: brandColor,
                      color: buttonTextColor,
                      borderRadius: `${borderRadius / 2}px`,
                    }}
                  >
                    {submitButtonText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerDashboardShell>
  );
}

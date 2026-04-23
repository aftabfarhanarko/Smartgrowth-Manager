"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeadsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCampaignId = searchParams.get("campaignId") || "";

  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(initialCampaignId);
  const [leads, setLeads] = useState([]);
  const [count, setCount] = useState(0);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [emailSending, setEmailSending] = useState(false);

  const selectedCampaign = campaigns.find((item) => String(item._id) === String(selectedCampaignId)) || null;
  const selectedLeadSet = useMemo(() => new Set(selectedLeadIds.map(String)), [selectedLeadIds]);
  const allLeadIds = useMemo(() => leads.map((lead) => String(lead._id)), [leads]);
  const allSelected = allLeadIds.length > 0 && allLeadIds.every((id) => selectedLeadSet.has(id));

  useEffect(() => {
    fetch("/api/campaigns", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load campaigns");
          setLoadingCampaigns(false);
          return;
        }

        const items = Array.isArray(json?.data) ? json.data : [];
        setCampaigns(items);
        if (!selectedCampaignId && items.length) {
          setSelectedCampaignId(String(items[0]._id));
        }
        setLoadingCampaigns(false);
      })
      .catch(() => {
        setError("Failed to load campaigns");
        setLoadingCampaigns(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      // Avoid calling setState synchronously within an effect.
      queueMicrotask(() => {
        setLeads([]);
        setCount(0);
        setSelectedLeadIds([]);
      });
      return;
    }

    // Avoid calling setState synchronously within an effect.
    queueMicrotask(() => {
      setLoadingLeads(true);
      setError("");
      setSelectedLeadIds([]);
    });
    fetch(`/api/campaigns/${selectedCampaignId}/leads`, { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load leads");
          setLoadingLeads(false);
          return;
        }
        setLeads(Array.isArray(json?.data?.leads) ? json.data.leads : []);
        setCount(Number(json?.data?.count || 0));
        setLoadingLeads(false);
      })
      .catch(() => {
        setError("Failed to load leads");
        setLoadingLeads(false);
      });
  }, [selectedCampaignId]);

  function toggleLeadSelection(leadId) {
    const id = String(leadId);
    setSelectedLeadIds((prev) => {
      const exists = prev.some((x) => String(x) === id);
      if (exists) return prev.filter((x) => String(x) !== id);
      return [...prev, leadId];
    });
  }

  function toggleSelectAllLeads() {
    if (!leads.length) return;
    if (allSelected) {
      setSelectedLeadIds([]);
      return;
    }
    setSelectedLeadIds(leads.map((lead) => lead._id));
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
  }

  function findAnswerByField(answers, field) {
    if (!answers || !field) return "";
    const baseKey = normalizeKey(field.label) || String(field.key || "");
    if (!baseKey) return "";

    if (Object.prototype.hasOwnProperty.call(answers, baseKey)) return answers[baseKey];

    const keys = Object.keys(answers);
    const matchedKey = keys.find((k) => k === baseKey || k.startsWith(baseKey));
    if (matchedKey) return answers[matchedKey];

    return "";
  }

  function sanitizePhoneDigits(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function handleExportToExcel() {
    setError("");

    if (!selectedCampaignId) {
      setError("Please select a campaign first.");
      return;
    }

    const phoneField = (selectedCampaign?.fields || []).find((f) => f.type === "phone") || null;
    const nameField =
      (selectedCampaign?.fields || []).find((f) => f.type === "text" && /name/i.test(String(f.label || f.key || ""))) ||
      (selectedCampaign?.fields || []).find((f) => f.type === "text") ||
      null;

    if (!phoneField || !nameField) {
      setError("Phone and Name fields must exist in the selected campaign.");
      return;
    }

    const leadSource = selectedLeadIds.length
      ? leads.filter((l) => selectedLeadSet.has(String(l._id)))
      : leads;

    const recipients = leadSource
      .map((lead) => {
        const phone = sanitizePhoneDigits(findAnswerByField(lead.answers || lead?.answers, phoneField));
        const name = String(findAnswerByField(lead.answers || lead?.answers, nameField) || "").trim().slice(0, 120);
        if (!phone) return null;
        return { Name: name, Phone: phone };
      })
      .filter(Boolean);

    if (!recipients.length) {
      setError("No valid recipients (phone missing).");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(recipients, { header: ["Name", "Phone"] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");
    XLSX.writeFile(workbook, "wp-recipients.xlsx");
  }

  function handleExportEmailExcel() {
    setError("");

    if (!selectedCampaignId) {
      setError("Please select a campaign first.");
      return;
    }

    const emailField = (selectedCampaign?.fields || []).find((f) => f.type === "email") || null;
    const nameField =
      (selectedCampaign?.fields || []).find((f) => f.type === "text" && /name/i.test(String(f.label || f.key || ""))) ||
      (selectedCampaign?.fields || []).find((f) => f.type === "text") ||
      null;

    if (!emailField || !nameField) {
      setError("Email and Name fields must exist in the selected campaign.");
      return;
    }

    const leadSource = selectedLeadIds.length
      ? leads.filter((l) => selectedLeadSet.has(String(l._id)))
      : leads;

    const recipients = leadSource
      .map((lead) => {
        const email = normalizeEmail(findAnswerByField(lead.answers || lead?.answers, emailField));
        const name = String(findAnswerByField(lead.answers || lead?.answers, nameField) || "").trim().slice(0, 120);
        if (!email || !EMAIL_RE.test(email)) return null;
        return { Name: name, Email: email };
      })
      .filter(Boolean);

    if (!recipients.length) {
      setError("No valid recipients (email missing or invalid).");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(recipients, { header: ["Name", "Email"] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");
    XLSX.writeFile(workbook, "email-recipients.xlsx");
  }

  async function handleSendToEmailPromotions() {
    setError("");

    if (!selectedCampaignId) {
      setError("Please select a campaign first.");
      return;
    }

    if (!selectedLeadIds.length) {
      setError("Select at least one lead first.");
      return;
    }

    const leadIds = selectedLeadIds;

    setEmailSending(true);
    try {
      const response = await fetch("/api/email-promotions/draft", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          leadIds,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || "Failed to create email draft");
        return;
      }
      const draftId = json?.data?.draftId;
      if (!draftId) {
        setError("draftId missing from response");
        return;
      }
      router.push(`/dashboard/email-promotions?draftId=${draftId}`);
    } catch {
      setError("Failed to create email draft");
    } finally {
      setEmailSending(false);
    }
  }

  const columns = useMemo(() => {
    const allKeys = new Set();
    const ordered = [];

    (selectedCampaign?.fields || []).forEach((field) => {
      const key = String(field?.label || "").trim() || String(field?.key || "").trim();
      if (key && !allKeys.has(key)) {
        allKeys.add(key);
        ordered.push(key);
      }
    });

    leads.forEach((lead) => {
      Object.keys(lead?.answers || {}).forEach((key) => {
        if (!allKeys.has(key)) {
          allKeys.add(key);
          ordered.push(key);
        }
      });
    });
    return ordered;
  }, [leads, selectedCampaign]);

  return (
    <CustomerDashboardShell title="Leads">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="rounded border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-600">Campaign Tabs</label>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {!campaigns.length ? (
              <button
                type="button"
                disabled
                className="whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-500"
              >
                No campaigns
              </button>
            ) : (
              campaigns.map((campaign) => {
                const isActive = String(selectedCampaignId) === String(campaign._id);
                return (
                  <button
                    key={campaign._id}
                    type="button"
                    onClick={() => setSelectedCampaignId(String(campaign._id))}
                    disabled={loadingCampaigns}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {campaign.name}
                  </button>
                );
              })
            )}
          </div>
          <span className="text-sm text-zinc-500">Total leads: {count}</span>
          <span className="text-sm text-zinc-500">Selected: {selectedLeadIds.length}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportToExcel}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Export to Excel (Name+Phone)
          </button>
          <button
            type="button"
            onClick={handleExportEmailExcel}
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Export to Excel (Name+Email)
          </button>
          <button
            type="button"
            onClick={handleSendToEmailPromotions}
            disabled={emailSending || loadingLeads}
            className="rounded bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {emailSending ? "Opening…" : "Send to Email Promotions"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded border p-4">
        {loadingLeads ? (
          <p className="text-sm text-zinc-500">Loading leads...</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2 w-16">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAllLeads} disabled={!leads.length} />
                      All
                    </label>
                  </th>
                  <th className="border p-2">Submitted At</th>
                  {columns.map((column) => (
                    <th key={column} className="border p-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead._id}>
                    <td className="border p-2">
                      <input
                        type="checkbox"
                        checked={selectedLeadSet.has(String(lead._id))}
                        onChange={() => toggleLeadSelection(lead._id)}
                      />
                    </td>
                    <td className="border p-2">
                      {lead?.submittedAt ? new Date(lead.submittedAt).toLocaleString() : "-"}
                    </td>
                    {columns.map((column) => {
                      const value = lead?.answers?.[column];
                      return (
                        <td key={column} className="border p-2">
                          {Array.isArray(value) ? value.join(", ") : value || "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CustomerDashboardShell>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import * as XLSX from "xlsx";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";
import { normalizePhoneDigits } from "@/lib/wp/phone";

function renderTemplatePreview({ templateText, templateLink, name }) {
  let message = String(templateText || "");
  const link = String(templateLink || "");
  message = message.replaceAll("{{name}}", String(name || ""));
  message = message.replaceAll("{{link}}", link);
  if (link && !message.includes(link)) message = `${message}\n\n${link}`;
  return message.trim();
}

function WpPromotionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get("draftId") || "";

  const [loadingUsage, setLoadingUsage] = useState(true);
  const [error, setError] = useState("");
  const [usageData, setUsageData] = useState(null);

  // Legacy usage-only flow (keep it available when no draftId).
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Draft flow (selected leads -> WP Promotions)
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCampaignName, setDraftCampaignName] = useState("");
  const [recipients, setRecipients] = useState([]);

  const [templateText, setTemplateText] = useState("Hi {{name}}! Your offer is ready. {{link}}");
  const [templateLink, setTemplateLink] = useState("");

  const intervalSeconds = 30;
  const [jobId, setJobId] = useState("");
  const [sendLogs, setSendLogs] = useState([]);
  const [excelUploading, setExcelUploading] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [waQrDataUrl, setWaQrDataUrl] = useState("");
  const [waLastError, setWaLastError] = useState("");
  const [jobState, setJobState] = useState({
    status: "",
    currentIndex: 0,
    sentCount: 0,
    total: 0,
    nextRunAt: null,
    lastError: "",
    lastWaLink: "",
  });
  const timerRef = useRef(null);

  async function loadUsage() {
    setError("");
    setLoadingUsage(true);
    try {
      const response = await fetch("/api/usage/me", { headers: getCustomerHeaders() });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(json?.error || "Failed to load usage data");
        return;
      }

      setUsageData(json?.data || null);
    } catch {
      setError("Failed to load usage data");
    } finally {
      setLoadingUsage(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadWaStatus() {
      try {
        const response = await fetch("/api/wp-promotions/whatsapp/status");
        const json = await response.json().catch(() => ({}));
        if (!mounted) return;
        setWaConnected(Boolean(json?.data?.connected));
        setWaQrDataUrl(json?.data?.lastQrDataUrl || "");
        setWaLastError(json?.data?.lastError || "");
      } catch {
        if (!mounted) return;
        setWaLastError("Failed to load WhatsApp status");
      }
    }

    loadWaStatus();
    const t = setInterval(loadWaStatus, 10000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!draftId) {
      setRecipients([]);
      setDraftCampaignName("");
      setJobId("");
      setSendLogs([]);
      setJobState({
        status: "",
        currentIndex: 0,
        sentCount: 0,
        total: 0,
        nextRunAt: null,
        lastError: "",
        lastWaLink: "",
      });
      return;
    }

    setDraftLoading(true);
    setError("");
    setRecipients([]);
    setDraftCampaignName("");
    setJobId("");
    setSendLogs([]);
    setJobState({
      status: "",
      currentIndex: 0,
      sentCount: 0,
      total: 0,
      nextRunAt: null,
      lastError: "",
      lastWaLink: "",
    });

    fetch(`/api/wp-promotions/draft/${draftId}`, { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load WP draft");
          setDraftLoading(false);
          return;
        }
        const data = json?.data || {};
        setDraftCampaignName(data?.campaignName || "");
        setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
        setDraftLoading(false);
      })
      .catch(() => {
        setError("Failed to load WP draft");
        setDraftLoading(false);
      });
  }, [draftId]);

  async function handleExcelUploadFile(file) {
    if (!file) return;
    setError("");

    setExcelUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        setError("Excel sheet not found.");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!Array.isArray(rows) || !rows.length) {
        setError("Excel rows not found.");
        return;
      }

      const keys = Object.keys(rows[0] || {});
      const norm = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ");

      const nameSyn = ["name", "full name", "customer name", "lead name", "recipient name"];
      const phoneSyn = ["phone", "mobile", "number", "msisdn", "whatsapp", "contact"];

      function pickKey(synList) {
        const lowerKeys = keys.map((k) => ({ raw: k, n: norm(k) }));
        for (const syn of synList) {
          const exact = lowerKeys.find((k) => k.n === norm(syn));
          if (exact) return exact.raw;
        }
        for (const syn of synList) {
          const partial = lowerKeys.find((k) => k.n.includes(norm(syn)));
          if (partial) return partial.raw;
        }
        return "";
      }

      const nameKey = pickKey(nameSyn);
      const phoneKey = pickKey(phoneSyn);

      if (!nameKey || !phoneKey) {
        setError("Excel must have columns for Name and Phone. Headers like Name/Phone work best.");
        return;
      }

      const recipients = [];
      for (const r of rows) {
        const rawName = String(r?.[nameKey] || "").trim().slice(0, 120);
        const rawPhone = String(r?.[phoneKey] || "");
        const phone = normalizePhoneDigits(rawPhone);
        if (!phone) continue;
        recipients.push({ name: rawName, phone });
        if (recipients.length > 5000) break;
      }

      if (!recipients.length) {
        setError("No valid recipients found in Excel (phone missing).");
        return;
      }

      const response = await fetch("/api/wp-promotions/draft/from-recipients", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ recipients }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || "Failed to create WP draft from Excel.");
        return;
      }

      const newDraftId = json?.data?.draftId;
      if (!newDraftId) {
        setError("draftId missing from response");
        return;
      }

      router.push(`/dashboard/wp-promotions?draftId=${newDraftId}`);
    } catch {
      setError("Failed to upload/parse Excel.");
    } finally {
      setExcelUploading(false);
    }
  }

  async function handleAddPromotion(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    const countNumber = Number(count);
    if (!Number.isFinite(countNumber) || countNumber < 1) {
      setSubmitError("count must be a positive number");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/wp-promotions", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ count: countNumber }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmitError(json?.error || "Failed to add WP promotion");
        return;
      }

      setSubmitSuccess(`Added ${json?.data?.incrementedBy ?? countNumber} WP promotions`);
      setCount(1);
      await loadUsage();
    } catch {
      setSubmitError("Failed to add WP promotion");
    } finally {
      setSubmitting(false);
    }
  }

  async function runJobOnce(activeJobId) {
    if (!activeJobId) return;
    const response = await fetch(`/api/wp-promotions/jobs/${activeJobId}/run`, {
      method: "POST",
      headers: getCustomerHeaders(),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setJobState((state) => ({
        ...state,
        status: "failed",
        lastError: json?.error || "Run failed",
      }));
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const data = json?.data || {};
    if (data?.lastLog) {
      setSendLogs((prev) => [...prev, data.lastLog].slice(-200));
    }

    setJobState((state) => ({
      ...state,
      status: data?.status || "",
      currentIndex: Number(data?.currentIndex || 0),
      sentCount: Number(data?.sentCount || 0),
      total: Number(data?.total || state.total || recipients?.length || 0),
      nextRunAt: data?.nextRunAt || null,
      lastError: data?.lastError || "",
      lastWaLink: data?.lastWaLink || "",
    }));

    if (data?.status === "completed" || data?.status === "failed") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setJobId("");
      // Refresh usage after completion.
      await loadUsage();
    }
  }

  async function handleBulkSend() {
    setError("");
    setSubmitError("");
    setSubmitSuccess("");

    if (!draftId) {
      setError("Select leads first from Leads page.");
      return;
    }

    if (!recipients.length) {
      setError("No recipients found in this draft.");
      return;
    }

    if (!templateText.trim()) {
      setError("Message text is required.");
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const response = await fetch("/api/wp-promotions/jobs", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          draftId,
          templateText,
          templateLink,
          intervalSeconds,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || "Failed to start bulk send");
        return;
      }

      const newJobId = json?.data?.jobId;
      if (!newJobId) {
        setError("jobId missing from response");
        return;
      }
      setJobId(newJobId);
      setSendLogs([]);
      setJobState({
        status: "running",
        currentIndex: 0,
        sentCount: 0,
        total: recipients.length,
        nextRunAt: null,
        lastError: "",
        lastWaLink: "",
      });

      timerRef.current = setInterval(() => runJobOnce(newJobId), intervalSeconds * 1000);
      await runJobOnce(newJobId); // returns "waiting" until nextRunAt
    } catch {
      setError("Failed to start bulk send");
    }
  }

  const used = Number(usageData?.usage?.wpPromotions || 0);
  const limit = Number(usageData?.limits?.wp_promotions_per_month || 0);
  const remaining = Math.max(0, limit - used);

  const showDraftUI = Boolean(draftId);
  const previewRecipient = recipients?.[0] || { name: "" };
  const previewMessage = useMemo(
    () => renderTemplatePreview({ templateText, templateLink, name: previewRecipient?.name }),
    [templateText, templateLink, previewRecipient?.name]
  );

  return (
    <CustomerDashboardShell title="WP Promotions">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {loadingUsage ? (
        <p className="text-sm text-zinc-500">Loading WP promotions usage...</p>
      ) : (
        <div className="grid gap-4">
          <div className="rounded border p-4">
            <h2 className="text-sm font-semibold text-zinc-700">WhatsApp Web connection</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Status: {waConnected ? "Connected" : "Not connected (QR needed)"}
            </p>

            {!waConnected ? (
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_240px]">
                <div>
                  <p className="text-xs text-zinc-600">
                    Scan QR once. After connecting, the same session will persist in <code>.wa-session</code>.
                  </p>
                  {waLastError ? (
                    <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{waLastError}</p>
                  ) : null}
                </div>
                {waQrDataUrl ? (
                  <div className="flex items-center justify-center rounded border bg-white p-2">
                    <Image
                      src={waQrDataUrl}
                      alt="WhatsApp QR"
                      width={192}
                      height={192}
                      className="h-48 w-48"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Waiting for QR...</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">Current month</p>
            <p className="mt-1 text-xl font-semibold">{usageData?.month || "-"}</p>
          </div>

          <div className="grid gap-3 rounded border p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-500">Used</p>
              <p className="text-2xl font-semibold">{used}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Limit</p>
              <p className="text-2xl font-semibold">{limit}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Remaining</p>
              <p className="text-2xl font-semibold">{remaining}</p>
            </div>
          </div>

          {showDraftUI ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded border p-4">
                <h2 className="mb-1 text-sm font-semibold text-zinc-700">Recipients</h2>
                <p className="text-sm text-zinc-500">
                  {draftLoading
                    ? "Loading..."
                    : `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`}
                  {draftCampaignName ? ` • ${draftCampaignName}` : ""}
                </p>

                {draftLoading ? (
                  <p className="mt-3 text-sm text-zinc-500">Loading recipients...</p>
                ) : (
                  <div className="mt-3 overflow-auto">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-zinc-50 text-left">
                          <th className="border p-2">Name</th>
                          <th className="border p-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.slice(0, 25).map((r) => (
                          <tr key={String(r.leadId || `${r.phone}-${r.name}`)}>
                            <td className="border p-2">{r.name || "-"}</td>
                            <td className="border p-2">{r.phone}</td>
                          </tr>
                        ))}
                        {recipients.length > 25 ? (
                          <tr>
                            <td className="border p-2 text-sm text-zinc-500" colSpan={2}>
                              Showing first 25. Total: {recipients.length}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 rounded border bg-zinc-50 p-3">
                  <h3 className="text-sm font-semibold text-zinc-800">Template</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Use placeholders: <code>{"{{name}}"}</code> and <code>{"{{link}}"}</code>.
                  </p>

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-xs text-zinc-600">
                      Message text
                      <textarea
                        className="min-h-[120px] w-full rounded border p-2 text-sm"
                        value={templateText}
                        onChange={(e) => setTemplateText(e.target.value)}
                        placeholder="Hi {{name}} ..."
                        disabled={jobState.status === "running" || Boolean(jobId)}
                      />
                    </label>

                    <label className="grid gap-1 text-xs text-zinc-600">
                      Link (optional)
                      <input
                        className="w-full rounded border p-2 text-sm"
                        value={templateLink}
                        onChange={(e) => setTemplateLink(e.target.value)}
                        placeholder="https://..."
                        disabled={jobState.status === "running" || Boolean(jobId)}
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBulkSend}
                        disabled={
                          draftLoading ||
                          !recipients.length ||
                          !waConnected ||
                          jobState.status === "running" ||
                          jobState.status === "waiting"
                        }
                        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        Bulk Send (30s, 3 min break/10)
                      </button>
                    </div>

                    {jobState.status ? (
                      <div className="rounded border bg-white p-3">
                        <p className="text-sm font-semibold text-zinc-800">
                          Job: {jobId ? String(jobId).slice(-8) : "-"} • {jobState.status}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          Sent {jobState.sentCount}/{jobState.total} • Remaining{" "}
                          {Math.max(0, jobState.total - jobState.sentCount)}
                        </p>
                        {jobState.nextRunAt ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            Next run: {new Date(jobState.nextRunAt).toLocaleString()}
                          </p>
                        ) : null}
                        {jobState.lastError ? (
                          <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{jobState.lastError}</p>
                        ) : null}
                        {jobState.lastWaLink ? (
                          <a
                            className="mt-2 inline-block rounded bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 underline"
                            href={jobState.lastWaLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Last WA link
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {sendLogs.length ? (
                      <div className="rounded border bg-white p-3">
                        <p className="text-sm font-semibold text-zinc-800">Send log</p>
                        <div className="mt-2 max-h-64 overflow-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-zinc-100 text-left">
                                <th className="border p-2">#</th>
                                <th className="border p-2">Name</th>
                                <th className="border p-2">Phone</th>
                                <th className="border p-2">Status</th>
                                <th className="border p-2">Detail</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sendLogs
                                .slice(-50)
                                .map((log, idx) => (
                                  <tr key={`${log.index}-${idx}`} className="align-top">
                                    <td className="border p-2">{log.index}</td>
                                    <td className="border p-2">{log.name || "-"}</td>
                                    <td className="border p-2">{log.phone}</td>
                                    <td className="border p-2">{log.status}</td>
                                    <td className="border p-2">
                                      {log.status === "failed" ? (
                                        <span className="text-red-600">{log.error || "-"}</span>
                                      ) : log.waLink ? (
                                        <a
                                          className="text-emerald-700 underline"
                                          href={log.waLink}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          link
                                        </a>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded border p-4">
                <h2 className="text-sm font-semibold text-zinc-700">Preview</h2>
                <p className="mt-1 text-xs text-zinc-500">First recipient</p>
                <div className="mt-3 rounded border bg-white p-3 text-sm whitespace-pre-wrap">
                  {previewMessage || "-"}
                </div>
                <div className="mt-4 rounded border bg-zinc-50 p-3">
                  <p className="text-xs font-semibold text-zinc-700">Note</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    This repo currently has no WhatsApp Business API integration. It generates WA deep-links and
                    increments usage as if queued/sent.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded border p-4">
                <h2 className="mb-1 text-sm font-semibold text-zinc-700">Upload recipients Excel</h2>
                <p className="text-sm text-zinc-500">
                  Excel headers should be <b>Name</b> and <b>Phone</b>.
                </p>

                <div className="mt-4 rounded border bg-zinc-50 p-4">
                  <label className="grid gap-2 text-sm text-zinc-700">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Choose file
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      disabled={excelUploading}
                      onChange={(e) => handleExcelUploadFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  {excelUploading ? (
                    <p className="mt-3 text-sm text-zinc-500">Processing Excel...</p>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      Tip: use `Export to Excel (Name+Phone)` from Leads first.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded border p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-700">Manual WP usage add (debug)</h2>
                <form onSubmit={handleAddPromotion} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1">
                    <span className="mb-1 block text-xs text-zinc-500">Count</span>
                    <input
                      className="w-full rounded border p-2"
                      type="number"
                      min={1}
                      step={1}
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-zinc-900 px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Add"}
                  </button>
                </form>

                {submitError && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{submitError}</p>}
                {submitSuccess && (
                  <p className="mt-3 rounded bg-emerald-50 p-2 text-sm font-medium text-emerald-700">
                    {submitSuccess}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </CustomerDashboardShell>
  );
}

export default function DashboardWpPromotionsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-50 p-6">
          <p className="text-sm text-zinc-500">Loading…</p>
        </main>
      }
    >
      <WpPromotionsPageContent />
    </Suspense>
  );
}

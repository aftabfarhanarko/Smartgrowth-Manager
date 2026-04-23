"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import Link from "next/link";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";
import RichTextEditor from "@/components/rich-text-editor";

function renderPreview({ subject, bodyText, templateLink, name }) {
  let subj = String(subject || "").replaceAll("{{name}}", String(name || ""));
  let body = String(bodyText || "").replaceAll("{{name}}", String(name || ""));
  const link = String(templateLink || "");
  body = body.replaceAll("{{link}}", link);
  if (link && !body.includes(link)) body = `${body}\n\n${link}`;
  return { subject: subj.trim(), body: body.trim() };
}

function renderPreviewHtml({ bodyMode, bodyText, templateLink, name }) {
  let body = String(bodyText || "").replaceAll("{{name}}", String(name || ""));
  const link = String(templateLink || "");
  body = body.replaceAll("{{link}}", link);
  if (link && !body.includes(link)) body = `${body}\n\n${link}`;
  if (bodyMode === "html") return body;
  const escaped = body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replaceAll("\n", "<br/>");
}

function renderPreviewShell({ subject, name, bodyHtml, footerText }) {
  const esc = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return `
<div style="margin:0; padding:16px; background:#f4f6fb; border-radius:10px; font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px; margin:0 auto;">
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; box-shadow:0 8px 24px rgba(15,23,42,0.10);">
      <h3 style="margin:0 0 12px; font-size:18px; color:#0f172a;">${esc(subject)}</h3>
      <div style="font-size:14px; color:#1f2937; line-height:1.7;">
        <style>
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
          th { background: #f8fafc; font-weight: 600; }
        </style>
        ${bodyHtml}
      </div>
    </div>
    ${
      footerText
        ? `<div style="text-align:center; margin-top:10px; font-size:11px; color:#94a3b8;">${esc(footerText)}</div>`
        : ""
    }
  </div>
</div>`.trim();
}

function EmailPromotionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get("draftId") || "";

  const [loadingUsage, setLoadingUsage] = useState(true);
  const [error, setError] = useState("");
  const [usageData, setUsageData] = useState(null);

  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  const [pdfPublicPath, setPdfPublicPath] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);

  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCampaignName, setDraftCampaignName] = useState("");
  const [recipients, setRecipients] = useState([]);

  const [subject, setSubject] = useState("Hi {{name}} — your document");
  const [bodyMode, setBodyMode] = useState("text");
  const [bodyText, setBodyText] = useState("Hello {{name}},\n\nPlease find the PDF attached.\n\n{{link}}");
  const [templateLink, setTemplateLink] = useState("");
  const [footerText, setFooterText] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [activeTab, setActiveTab] = useState("smtp");

  const intervalSeconds = 5;
  const [jobId, setJobId] = useState("");
  const [sendLogs, setSendLogs] = useState([]);
  const [excelUploading, setExcelUploading] = useState(false);
  const [jobState, setJobState] = useState({
    status: "",
    currentIndex: 0,
    sentCount: 0,
    total: 0,
    nextRunAt: null,
    lastError: "",
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

  async function loadSmtp() {
    setSmtpLoading(true);
    setSmtpMessage("");
    try {
      const response = await fetch("/api/email-promotions/smtp", { headers: getCustomerHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSmtpMessage(json?.error || "Failed to load SMTP settings");
        return;
      }
      const d = json?.data || {};
      setSmtpConfigured(Boolean(d.configured));
      setSmtpHost(d.host || "");
      setSmtpPort(String(d.port ?? 587));
      setSmtpSecure(Boolean(d.secure));
      setSmtpUser(d.user || "");
      setSmtpFromEmail(d.fromEmail || "");
      setSmtpFromName(d.fromName || "");
      setSmtpPassword("");
    } catch {
      setSmtpMessage("Failed to load SMTP settings");
    } finally {
      setSmtpLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const response = await fetch("/api/email-promotions/templates", {
        headers: getCustomerHeaders(),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const list = Array.isArray(json?.data?.templates) ? json.data.templates : [];
      setTemplates(list);
    } catch {
      // keep silent; UI is still usable without stored templates
    }
  }

  useEffect(() => {
    loadUsage();
    loadSmtp();
    loadTemplates();
  }, []);

  function handleSelectTemplate(templateId) {
    setSelectedTemplateId(templateId);
    const t = templates.find((item) => String(item._id) === String(templateId));
    if (!t) return;
    setTemplateName(t.name || "");
    setSubject(t.subject || "");
    setBodyMode(t.bodyMode || "text");
    setBodyText(t.bodyText || "");
    setTemplateLink(t.templateLink || "");
    setFooterText(t.footerText || "");
    setTemplateMessage(`Template "${t.name}" selected.`);
  }

  async function handleCreateTemplate() {
    setTemplateMessage("");
    if (!templateName.trim()) {
      setTemplateMessage("Template name লাগবে।");
      return;
    }
    if (!subject.trim() || !bodyText.trim()) {
      setTemplateMessage("Subject আর Body লাগবে।");
      return;
    }

    setTemplateBusy(true);
    try {
      const response = await fetch("/api/email-promotions/templates", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          name: templateName,
          subject,
          bodyMode,
          bodyText,
          templateLink,
          footerText,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTemplateMessage(json?.error || "Template save failed");
        return;
      }
      const created = json?.data?.template;
      setTemplateMessage("Template saved.");
      await loadTemplates();
      if (created?._id) setSelectedTemplateId(String(created._id));
    } catch {
      setTemplateMessage("Template save failed");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function handleUpdateTemplate() {
    setTemplateMessage("");
    if (!selectedTemplateId) {
      setTemplateMessage("আগে template select করুন।");
      return;
    }
    if (!templateName.trim() || !subject.trim() || !bodyText.trim()) {
      setTemplateMessage("Name, Subject, Body লাগবে।");
      return;
    }
    setTemplateBusy(true);
    try {
      const response = await fetch(`/api/email-promotions/templates/${selectedTemplateId}`, {
        method: "PUT",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          name: templateName,
          subject,
          bodyMode,
          bodyText,
          templateLink,
          footerText,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTemplateMessage(json?.error || "Template update failed");
        return;
      }
      setTemplateMessage("Template updated.");
      await loadTemplates();
    } catch {
      setTemplateMessage("Template update failed");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function handleDeleteTemplate() {
    setTemplateMessage("");
    if (!selectedTemplateId) {
      setTemplateMessage("আগে template select করুন।");
      return;
    }
    setTemplateBusy(true);
    try {
      const response = await fetch(`/api/email-promotions/templates/${selectedTemplateId}`, {
        method: "DELETE",
        headers: getCustomerHeaders(),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTemplateMessage(json?.error || "Template delete failed");
        return;
      }
      setSelectedTemplateId("");
      setTemplateName("");
      setTemplateMessage("Template deleted.");
      await loadTemplates();
    } catch {
      setTemplateMessage("Template delete failed");
    } finally {
      setTemplateBusy(false);
    }
  }

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
    });

    fetch(`/api/email-promotions/draft/${draftId}`, { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load email draft");
          setDraftLoading(false);
          return;
        }
        const data = json?.data || {};
        setDraftCampaignName(data?.campaignName || "");
        setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
        setDraftLoading(false);
      })
      .catch(() => {
        setError("Failed to load email draft");
        setDraftLoading(false);
      });
  }, [draftId]);

  useEffect(() => {
    if (activeTab !== "bulk") return;
    if (selectedTemplateId) return;
    if (!templates.length) return;
    handleSelectTemplate(String(templates[0]?._id || ""));
  }, [activeTab, selectedTemplateId, templates]);

  async function handleSaveSmtp(event) {
    event.preventDefault();
    setSmtpMessage("");
    setSmtpSaving(true);
    try {
      const response = await fetch("/api/email-promotions/smtp", {
        method: "PUT",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          secure: smtpSecure,
          user: smtpUser,
          password: smtpPassword,
          fromEmail: smtpFromEmail,
          fromName: smtpFromName,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSmtpMessage(json?.error || "Save failed");
        return;
      }
      setSmtpMessage("Saved.");
      setSmtpPassword("");
      await loadSmtp();
    } catch {
      setSmtpMessage("Save failed");
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleTestSmtp() {
    setSmtpMessage("");
    if (!testEmail.trim()) {
      setSmtpMessage("Enter a test email address.");
      return;
    }
    setTestSending(true);
    try {
      const response = await fetch("/api/email-promotions/smtp/test", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ testEmail: testEmail.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSmtpMessage(json?.error || "Test failed");
        return;
      }
      setSmtpMessage("Test email sent.");
    } catch {
      setSmtpMessage("Test failed");
    } finally {
      setTestSending(false);
    }
  }

  async function handlePdfUpload(file) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    setError("");
    setPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/email-promotions/upload", {
        method: "POST",
        body: formData,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || "Upload failed");
        return;
      }
      const path = json?.data?.publicPath;
      if (!path) {
        setError("Upload response missing path");
        return;
      }
      setPdfPublicPath(path);
    } catch {
      setError("Upload failed");
    } finally {
      setPdfUploading(false);
    }
  }

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
      const emailSyn = ["email", "e-mail", "mail", "email address"];

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
      const emailKey = pickKey(emailSyn);

      if (!nameKey || !emailKey) {
        setError("Excel must have columns for Name and Email.");
        return;
      }

      const list = [];
      for (const r of rows) {
        const rawName = String(r?.[nameKey] || "").trim().slice(0, 120);
        const rawEmail = String(r?.[emailKey] || "")
          .trim()
          .toLowerCase();
        if (!rawEmail) continue;
        list.push({ name: rawName, email: rawEmail });
        if (list.length > 5000) break;
      }

      if (!list.length) {
        setError("No valid recipients found in Excel (email missing).");
        return;
      }

      const response = await fetch("/api/email-promotions/draft/from-recipients", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ recipients: list }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || "Failed to create draft from Excel.");
        return;
      }

      const newDraftId = json?.data?.draftId;
      if (!newDraftId) {
        setError("draftId missing from response");
        return;
      }

      router.push(`/dashboard/email-promotions?draftId=${newDraftId}`);
    } catch {
      setError("Failed to upload/parse Excel.");
    } finally {
      setExcelUploading(false);
    }
  }

  async function runJobOnce(activeJobId) {
    if (!activeJobId) return;
    const response = await fetch(`/api/email-promotions/jobs/${activeJobId}/run`, {
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
    }));

    if (data?.status === "completed" || data?.status === "failed") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setJobId("");
      await loadUsage();
    }
  }

  async function handleBulkSend() {
    setError("");
    setSmtpMessage("");

    if (!draftId) {
      setError("Select leads from the Leads page or upload an Excel with Name + Email.");
      return;
    }

    if (!recipients.length) {
      setError("No recipients found in this draft.");
      return;
    }

    if (!selectedTemplateId) {
      setError("Bulk send করার আগে একটি saved template select করুন।");
      return;
    }

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    if (!bodyText.trim()) {
      setError("Email body is required.");
      return;
    }

    if (!smtpConfigured) {
      setError("Save SMTP settings before sending.");
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const response = await fetch("/api/email-promotions/jobs", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          draftId,
          subject,
          bodyMode,
          bodyText,
          templateLink,
          footerText,
          intervalSeconds,
          attachmentPublicPath: pdfPublicPath || "",
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
      });

      timerRef.current = setInterval(() => runJobOnce(newJobId), intervalSeconds * 1000);
      await runJobOnce(newJobId);
    } catch {
      setError("Failed to start bulk send");
    }
  }

  const used = Number(usageData?.usage?.emails || 0);
  const limit = Number(usageData?.limits?.emails_per_month || 0);
  const remaining = Math.max(0, limit - used);

  const showDraftUI = Boolean(draftId);
  const previewRecipient = recipients?.[0] || { name: "" };
  const preview = useMemo(
    () => renderPreview({ subject, bodyText, templateLink, name: previewRecipient?.name }),
    [subject, bodyText, templateLink, previewRecipient?.name]
  );
  const previewHtml = useMemo(
    () => renderPreviewHtml({ bodyMode, bodyText, templateLink, name: previewRecipient?.name }),
    [bodyMode, bodyText, templateLink, previewRecipient?.name]
  );
  const previewShellHtml = useMemo(
    () =>
      renderPreviewShell({
        subject: preview.subject || "Promotion",
        name: previewRecipient?.name || "Customer",
        bodyHtml: previewHtml || "",
        footerText: footerText || "",
      }),
    [preview.subject, previewRecipient?.name, previewHtml, footerText]
  );

  return (
    <CustomerDashboardShell title="Email Promotions">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {loadingUsage ? (
        <p className="text-sm text-zinc-500">Loading email promotions usage...</p>
      ) : (
        <div className="grid gap-4">
          <div className="rounded border p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("smtp")}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  activeTab === "smtp" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
                }`}
              >
                SMTP Setup
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("template")}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  activeTab === "template" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
                }`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bulk")}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  activeTab === "bulk" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
                }`}
              >
                Bulk Send
              </button>
            </div>
          </div>

          {activeTab === "smtp" ? (
            <div className="rounded border p-4">
            <h2 className="text-sm font-semibold text-zinc-700">SMTP (connect your mailbox)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Status: {smtpLoading ? "Loading…" : smtpConfigured ? "Configured" : "Not configured"}
            </p>

            {smtpLoading ? (
              <p className="mt-2 text-sm text-zinc-500">Loading SMTP…</p>
            ) : (
              <form onSubmit={handleSaveSmtp} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-zinc-600 sm:col-span-2">
                  SMTP host
                  <input
                    className="rounded border p-2 text-sm"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-600">
                  Port
                  <input
                    className="rounded border p-2 text-sm"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    inputMode="numeric"
                    required
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
                  SSL/TLS (often ON for port 465)
                </label>
                <label className="grid gap-1 text-xs text-zinc-600 sm:col-span-2">
                  Username
                  <input
                    className="rounded border p-2 text-sm"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-600 sm:col-span-2">
                  Password {smtpConfigured ? "(leave blank to keep)" : ""}
                  <input
                    type="password"
                    className="rounded border p-2 text-sm"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-600">
                  From email
                  <input
                    type="email"
                    className="rounded border p-2 text-sm"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-600">
                  From name (optional)
                  <input
                    className="rounded border p-2 text-sm"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={smtpSaving}
                    className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {smtpSaving ? "Saving…" : "Save SMTP"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
              <label className="grid gap-1 text-xs text-zinc-600">
                Send test to
                <input
                  type="email"
                  className="rounded border p-2 text-sm"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={testSending || !smtpConfigured}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                {testSending ? "Sending…" : "Send test"}
              </button>
            </div>
            {smtpMessage ? (
              <p className="mt-2 rounded bg-zinc-100 p-2 text-sm text-zinc-700">{smtpMessage}</p>
            ) : null}
            </div>
          ) : null}

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

          {(showDraftUI || activeTab === "template") && activeTab !== "smtp" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded border p-4">
                {activeTab === "bulk" ? (
                  <>
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
                              <th className="border p-2">Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipients.slice(0, 25).map((r) => (
                              <tr key={String(r.leadId || `${r.email}-${r.name}`)}>
                                <td className="border p-2">{r.name || "-"}</td>
                                <td className="border p-2">{r.email}</td>
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
                      <h3 className="text-sm font-semibold text-zinc-800">PDF attachment (optional)</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Upload once; it will be attached to every email in this run.
                      </p>
                      <label className="mt-3 grid gap-2 text-sm text-zinc-700">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Choose PDF</span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={pdfUploading}
                          onChange={(e) => handlePdfUpload(e.target.files?.[0] || null)}
                        />
                      </label>
                      {pdfUploading ? <p className="mt-2 text-sm text-zinc-500">Uploading…</p> : null}
                      {pdfPublicPath ? (
                        <p className="mt-2 break-all text-xs text-emerald-700">
                          Ready: {pdfPublicPath}
                          <button
                            type="button"
                            className="ml-2 underline"
                            onClick={() => setPdfPublicPath("")}
                          >
                            Clear
                          </button>
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}

                <div className="mt-4 rounded border bg-zinc-50 p-3">
                  <h3 className="text-sm font-semibold text-zinc-800">Message</h3>
                  {activeTab === "template" ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Placeholders: <code>{"{{name}}"}</code>, <code>{"{{link}}"}</code>.
                      Formatting: <code>**bold**</code>, <code>__underline__</code>, <code>*italic*</code>.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">
                      Bulk send এ শুধু saved template select করুন। Create/Edit করতে Create tab ব্যবহার করুন।
                    </p>
                  )}

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-xs text-zinc-600">
                      Template select
                      <select
                        className="w-full rounded border p-2 text-sm"
                        value={selectedTemplateId}
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                        disabled={templateBusy || jobState.status === "running" || Boolean(jobId)}
                      >
                        <option value="">-- Select saved template --</option>
                        {templates.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {activeTab === "template" ? (
                      <>
                        <label className="grid gap-1 text-xs text-zinc-600">
                          Template name
                          <input
                            className="w-full rounded border p-2 text-sm"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Eid offer template"
                            disabled={templateBusy || jobState.status === "running" || Boolean(jobId)}
                          />
                        </label>

                        <label className="grid gap-1 text-xs text-zinc-600">
                          Subject
                          <input
                            className="w-full rounded border p-2 text-sm"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={jobState.status === "running" || Boolean(jobId)}
                          />
                        </label>

                        <label className="grid gap-1 text-xs text-zinc-600">
                          Body mode
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setBodyMode("text")}
                              className={`rounded border px-2 py-1 text-xs ${bodyMode === "text" ? "bg-zinc-900 text-white" : "bg-white text-zinc-800"}`}
                              disabled={templateBusy || jobState.status === "running" || Boolean(jobId)}
                            >
                              Text
                            </button>
                            <button
                              type="button"
                              onClick={() => setBodyMode("html")}
                              className={`rounded border px-2 py-1 text-xs ${bodyMode === "html" ? "bg-zinc-900 text-white" : "bg-white text-zinc-800"}`}
                              disabled={templateBusy || jobState.status === "running" || Boolean(jobId)}
                            >
                              HTML Design
                            </button>
                          </div>
                        </label>

                        <label className="grid gap-1 text-xs text-zinc-600">
                          Body
                          <RichTextEditor
                            value={bodyText}
                            onChange={setBodyText}
                            outputMode={bodyMode === "html" ? "html" : "text"}
                            minHeight={bodyMode === "html" ? 260 : 180}
                            disabled={jobState.status === "running" || Boolean(jobId)}
                          />
                        </label>

                        <label className="grid gap-1 text-xs text-zinc-600">
                          Link (optional, for {"{{link}}"})
                          <input
                            className="w-full rounded border p-2 text-sm"
                            value={templateLink}
                            onChange={(e) => setTemplateLink(e.target.value)}
                            placeholder="https://..."
                            disabled={jobState.status === "running" || Boolean(jobId)}
                          />
                        </label>

                        <label className="grid gap-1 text-xs text-zinc-600">
                          Footer text (custom)
                          <input
                            className="w-full rounded border p-2 text-sm"
                            value={footerText}
                            onChange={(e) => setFooterText(e.target.value)}
                            placeholder="Your company name, support info, etc."
                            disabled={jobState.status === "running" || Boolean(jobId)}
                          />
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCreateTemplate}
                            disabled={templateBusy || jobState.status === "running" || Boolean(jobId)}
                            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
                          >
                            Save as new template
                          </button>
                          <button
                            type="button"
                            onClick={handleUpdateTemplate}
                            disabled={templateBusy || !selectedTemplateId || jobState.status === "running" || Boolean(jobId)}
                            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
                          >
                            Update selected template
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteTemplate}
                            disabled={templateBusy || !selectedTemplateId || jobState.status === "running" || Boolean(jobId)}
                            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            Delete selected template
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded border bg-white p-3 text-sm text-zinc-700">
                        {selectedTemplateId ? (
                          <>
                            <p>
                              <span className="font-medium">Selected:</span> {templateName || "Template"}
                            </p>
                            <p className="mt-1">
                              <span className="font-medium">Subject:</span> {subject || "-"}
                            </p>
                            <p className="mt-1">
                              <span className="font-medium">Mode:</span>{" "}
                              {bodyMode === "html" ? "HTML Design" : "Text"}
                            </p>
                          </>
                        ) : (
                          <p className="text-amber-700">একটি template select করুন, তারপর preview দেখুন এবং bulk send দিন।</p>
                        )}
                      </div>
                    )}

                    {templateMessage ? (
                      <p className="rounded bg-zinc-100 p-2 text-xs text-zinc-700">{templateMessage}</p>
                    ) : null}

                    {activeTab === "bulk" ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBulkSend}
                          disabled={
                            draftLoading ||
                            !recipients.length ||
                            !smtpConfigured ||
                            jobState.status === "running" ||
                            jobState.status === "waiting"
                          }
                          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          Bulk send (every 5 seconds, no break)
                        </button>
                      </div>
                    ) : null}

                    {activeTab === "bulk" && jobState.status ? (
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
                      </div>
                    ) : null}

                    {activeTab === "bulk" && sendLogs.length ? (
                      <div className="rounded border bg-white p-3">
                        <p className="text-sm font-semibold text-zinc-800">Send log</p>
                        <div className="mt-2 max-h-64 overflow-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-zinc-100 text-left">
                                <th className="border p-2">#</th>
                                <th className="border p-2">Name</th>
                                <th className="border p-2">Email</th>
                                <th className="border p-2">Status</th>
                                <th className="border p-2">Detail</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sendLogs.slice(-50).map((log, idx) => (
                                <tr key={`${log.index}-${idx}`} className="align-top">
                                  <td className="border p-2">{log.index}</td>
                                  <td className="border p-2">{log.name || "-"}</td>
                                  <td className="border p-2">{log.email}</td>
                                  <td className="border p-2">{log.status}</td>
                                  <td className="border p-2">
                                    {log.status === "failed" ? (
                                      <span className="text-red-600">{log.error || "-"}</span>
                                    ) : (
                                      "ok"
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
                {activeTab === "bulk" && !selectedTemplateId ? (
                  <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700">
                    আগে একটি saved template select করুন, তারপর email preview দেখাবে।
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-medium text-zinc-600">Subject</p>
                <p className="text-sm font-semibold text-zinc-900">{preview.subject || "-"}</p>
                <p className="mt-3 text-xs font-medium text-zinc-600">Body</p>
                {bodyMode === "html" ? (
                  <div
                    className="mt-1 rounded border bg-white p-3 text-sm"
                    dangerouslySetInnerHTML={{ __html: previewShellHtml || "-" }}
                  />
                ) : (
                  <div className="mt-1 rounded border bg-white p-3 text-sm whitespace-pre-wrap">{preview.body || "-"}</div>
                )}
                <div className="mt-4 rounded border bg-zinc-50 p-3">
                  <Link href="/dashboard/leads" className="text-sm font-medium text-zinc-900 underline">
                    Leads
                  </Link>
                  <p className="mt-1 text-xs text-zinc-600">
                    Select leads with email + name fields, then “Send to Email Promotions”, or use Excel here.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === "bulk" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded border p-4">
                <h2 className="mb-1 text-sm font-semibold text-zinc-700">Upload recipients (Excel)</h2>
                <p className="text-sm text-zinc-500">
                  Headers should be <b>Name</b> and <b>Email</b>.
                </p>

                <div className="mt-4 rounded border bg-zinc-50 p-4">
                  <label className="grid gap-2 text-sm text-zinc-700">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Choose file</span>
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
                      Or use <Link href="/dashboard/leads">Leads</Link> → select recipients → Send to Email Promotions.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded border p-4">
                <h2 className="mb-1 text-sm font-semibold text-zinc-700">Campaigns</h2>
                <p className="text-sm text-zinc-600">Forms and lead fields are configured per campaign.</p>
                <div className="mt-3">
                  <Link
                    href="/dashboard/campaigns"
                    className="inline-block rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    Go to Campaigns
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </CustomerDashboardShell>
  );
}

export default function DashboardEmailPromotionsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-50 p-6">
          <p className="text-sm text-zinc-500">Loading…</p>
        </main>
      }
    >
      <EmailPromotionsPageContent />
    </Suspense>
  );
}

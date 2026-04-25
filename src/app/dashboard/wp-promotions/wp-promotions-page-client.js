"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import * as XLSX from "xlsx";
import { getCustomerHeaders } from "@/components/customer-api";
import RichTextEditor from "@/components/rich-text-editor";
import { normalizePhoneDigits } from "@/lib/wp/phone";
import { motion, AnimatePresence } from "framer-motion";

function renderTemplatePreview({ templateText, templateLink, name }) {
  let message = String(templateText || "");
  const link = String(templateLink || "");
  message = message.replaceAll("{{name}}", String(name || ""));
  message = message.replaceAll("{{link}}", link);
  if (link && !message.includes(link)) message = `${message}\n\n${link}`;
  return message.trim();
}

function renderTemplatePreviewHtml(message) {
  const escaped = String(message || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replaceAll("\n", "<br/>");
}

function WpPromotionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get("draftId") || "";

  const [loadingUsage, setLoadingUsage] = useState(true);
  const [error, setError] = useState("");
  const [usageData, setUsageData] = useState(null);
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
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
  const [activeTab, setActiveTab] = useState("bulk");
  const [jobState, setJobState] = useState({
    status: "", currentIndex: 0, sentCount: 0, total: 0, nextRunAt: null, lastError: "", lastWaLink: ""
  });
  const timerRef = useRef(null);

  async function loadUsage() {
    try {
      const res = await fetch("/api/usage/me", { headers: getCustomerHeaders() });
      const json = await res.json();
      if (res.ok) setUsageData(json?.data || null);
    } catch { setError("Failed to load usage data"); }
    finally { setLoadingUsage(false); }
  }

  useEffect(() => { loadUsage(); }, []);

  useEffect(() => {
    let mounted = true;
    async function loadWaStatus() {
      try {
        const res = await fetch("/api/wp-promotions/whatsapp/status");
        const json = await res.json();
        if (!mounted) return;
        setWaConnected(Boolean(json?.data?.connected));
        setWaQrDataUrl(json?.data?.lastQrDataUrl || "");
        setWaLastError(json?.data?.lastError || "");
      } catch { if (mounted) setWaLastError("Failed to load WhatsApp status"); }
    }
    loadWaStatus();
    const t = setInterval(loadWaStatus, 10000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!draftId) {
      setRecipients([]); setDraftCampaignName(""); setJobId(""); setSendLogs([]);
      setJobState({ status: "", currentIndex: 0, sentCount: 0, total: 0, nextRunAt: null, lastError: "", lastWaLink: "" });
      return;
    }
    setDraftLoading(true);
    fetch(`/api/wp-promotions/draft/${draftId}`, { headers: getCustomerHeaders() })
      .then(r => r.json())
      .then(json => {
        const data = json?.data || {};
        setDraftCampaignName(data?.campaignName || "");
        setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
      })
      .finally(() => setDraftLoading(false));
  }, [draftId]);

  async function handleExcelUpload(file) {
    if (!file) return;
    setExcelUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const keys = Object.keys(rows[0] || {});
      const nameKey = keys.find(k => /name/i.test(k));
      const phoneKey = keys.find(k => /phone|mobile|number/i.test(k));
      if (!nameKey || !phoneKey) throw new Error("Excel must have Name and Phone columns.");
      const cleaned = rows.map(r => ({ name: String(r[nameKey]).trim(), phone: normalizePhoneDigits(r[phoneKey]) })).filter(r => r.phone);
      const res = await fetch("/api/wp-promotions/draft/from-recipients", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ recipients: cleaned }),
      });
      const json = await res.json();
      if (json.data?.draftId) router.push(`/dashboard/wp-promotions?draftId=${json.data.draftId}`);
    } catch (err) { setError(err.message); }
    finally { setExcelUploading(false); }
  }

  async function runJobOnce(activeJobId) {
    if (!activeJobId) return;
    const res = await fetch(`/api/wp-promotions/jobs/${activeJobId}/run`, { method: "POST", headers: getCustomerHeaders() });
    const json = await res.json();
    const data = json?.data || {};
    if (data?.lastLog) setSendLogs(prev => [...prev, data.lastLog].slice(-200));
    setJobState(s => ({ ...s, ...data }));
    if (data?.status === "completed" || data?.status === "failed") {
      if (timerRef.current) clearInterval(timerRef.current);
      setJobId("");
      loadUsage();
    }
  }

  async function handleBulkSend() {
    if (!draftId || !recipients.length || !templateText.trim()) return;
    try {
      const res = await fetch("/api/wp-promotions/jobs", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ draftId, templateText, templateLink, intervalSeconds }),
      });
      const json = await res.json();
      if (json.data?.jobId) {
        setJobId(json.data.jobId);
        setSendLogs([]);
        setJobState({ status: "running", currentIndex: 0, sentCount: 0, total: recipients.length, nextRunAt: null, lastError: "", lastWaLink: "" });
        timerRef.current = setInterval(() => runJobOnce(json.data.jobId), intervalSeconds * 1000);
        runJobOnce(json.data.jobId);
      }
    } catch { setError("Failed to start bulk send"); }
  }

  const used = Number(usageData?.usage?.wpPromotions || 0);
  const limit = Number(usageData?.limits?.wp_promotions_per_month || 0);
  const remaining = Math.max(0, limit - used);
  const previewMessage = renderTemplatePreview({ templateText, templateLink, name: recipients[0]?.name || "Customer" });

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">WhatsApp Promotions</h1>
          <p className="mt-2 text-slate-500">Automate your outreach with high-converting WA messages.</p>
        </div>
        <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button onClick={() => setActiveTab("bulk")} className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === "bulk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Bulk Send</button>
          <button onClick={() => setActiveTab("connect")} className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === "connect" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>WhatsApp Connect</button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Used", val: used, color: "text-slate-900" },
          { label: "Limit", val: limit, color: "text-slate-900" },
          { label: "Remaining", val: remaining, color: "text-indigo-600" }
        ].map((s, i) => (
          <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
            <p className={`mt-1 text-3xl font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </section>

      {activeTab === "connect" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${waConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <h2 className="text-xl font-bold text-slate-900">{waConnected ? "WhatsApp Connected" : "Connect WhatsApp"}</h2>
          </div>
          {!waConnected && (
            <div className="mt-8 grid gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                <p className="text-slate-500">Scan the QR code with your WhatsApp app to enable automated messaging.</p>
                <div className="space-y-4">
                  {[
                    "Open WhatsApp on your phone",
                    "Tap Menu or Settings and select Linked Devices",
                    "Tap on Link a Device",
                    "Point your phone to this screen to capture the code"
                  ].map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">{i + 1}</span>
                      <p className="text-sm font-medium text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12">
                {waQrDataUrl ? (
                  <div className="rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
                    <Image src={waQrDataUrl} alt="WhatsApp QR" width={240} height={240} className="h-60 w-60" />
                  </div>
                ) : (
                  <div className="text-center">
                    {waLastError ? (
                      <div className="space-y-4">
                        <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-rose-100 text-rose-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-rose-700">Connection Failed</p>
                          <p className="text-xs text-rose-500 max-w-[240px] mx-auto">{waLastError}</p>
                        </div>
                        <button 
                          onClick={() => window.location.reload()}
                          className="text-xs font-bold text-indigo-600 hover:underline"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                        <p className="mt-4 text-sm font-bold text-slate-500">Generating QR Code...</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">1. Select Recipients</h2>
                {draftId && <button onClick={() => router.push("/dashboard/leads")} className="text-xs font-bold text-indigo-600 hover:underline">Change Draft</button>}
              </div>
              {!draftId ? (
                <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
                  <p className="text-sm font-medium text-slate-500">No recipients selected. Upload an excel or select from leads.</p>
                  <label className="mt-4 cursor-pointer rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-black">
                    {excelUploading ? "Processing..." : "Upload Excel"}
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleExcelUpload(e.target.files?.[0])} disabled={excelUploading} />
                  </label>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">{recipients.length}</div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900">{draftCampaignName || "Selected Leads"}</p>
                      <p className="text-xs text-indigo-600">Ready to send</p>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-auto rounded-xl border border-slate-100 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                        <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recipients.slice(0, 10).map((r, i) => <tr key={i}><td className="px-4 py-2">{r.name}</td><td className="px-4 py-2 font-mono">{r.phone}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8">
              <h2 className="text-xl font-bold text-slate-900">2. Compose Message</h2>
              <div className="mt-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Message Template</label>
                  <RichTextEditor value={templateText} onChange={setTemplateText} outputMode="text" minHeight={200} disabled={!!jobId} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Action Link (Optional)</label>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-600" value={templateLink} onChange={e => setTemplateLink(e.target.value)} placeholder="https://..." disabled={!!jobId} />
                </div>
                <button 
                  onClick={handleBulkSend} disabled={!draftId || !waConnected || !!jobId}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  {jobId ? "Send in Progress..." : "Start Bulk Send"}
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white p-8">
              <h3 className="font-bold text-slate-900">Live Preview</h3>
              <div className="mt-6 rounded-2xl bg-slate-100 p-4 shadow-inner">
                <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
                  <div dangerouslySetInnerHTML={{ __html: renderTemplatePreviewHtml(previewMessage) }} />
                </div>
              </div>
            </section>

            {jobState.status && (
              <section className="rounded-3xl border border-slate-200 bg-white p-8">
                <h3 className="font-bold text-slate-900">Job Status</h3>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500 uppercase tracking-tight">Status</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${jobState.status === "running" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>{jobState.status}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(jobState.sentCount / jobState.total) * 100}%` }} className="h-full bg-indigo-600" />
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900">
                    <span>{jobState.sentCount} Sent</span>
                    <span>{jobState.total} Total</span>
                  </div>
                </div>
              </section>
            )}

            {sendLogs.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <h3 className="font-bold text-slate-900">Send History</h3>
                <div className="mt-4 max-h-60 overflow-auto space-y-2">
                  {sendLogs.slice(-20).reverse().map((log, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-[10px]">
                      <div>
                        <p className="font-bold text-slate-900">{log.name}</p>
                        <p className="text-slate-500">{log.phone}</p>
                      </div>
                      <span className={`font-bold ${log.status === "sent" ? "text-emerald-600" : "text-rose-600"}`}>{log.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default function DashboardWpPromotionsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>}>
      <WpPromotionsPageContent />
    </Suspense>
  );
}

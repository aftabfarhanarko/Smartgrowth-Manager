"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCampaignName, setDraftCampaignName] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [templateText, setTemplateText] = useState("Hi {{name}}! Your offer is ready. {{link}}");
  const [templateLink, setTemplateLink] = useState("");
  const intervalSeconds = 5;
  const [jobId, setJobId] = useState("");
  const [sendLogs, setSendLogs] = useState([]);
  const [excelUploading, setExcelUploading] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [waQrDataUrl, setWaQrDataUrl] = useState("");
  const [waLastError, setWaLastError] = useState("");
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
    const t = setInterval(loadWaStatus, 2000);
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

  async function handleWaReconnect() {
    setWaLastError("Resetting connection...");
    try {
      await fetch("/api/wp-promotions/whatsapp/logout", { method: "POST" });
      setWaConnected(false);
      setWaQrDataUrl("");
      setWaLastError("");
    } catch { setWaLastError("Failed to reset connection"); }
  }

  const used = Number(usageData?.usage?.wpPromotions || 0);
  const limit = Number(usageData?.limits?.wp_promotions_per_month || 0);
  const remaining = Math.max(0, limit - used);
  const previewMessage = renderTemplatePreview({ templateText, templateLink, name: recipients[0]?.name || "Customer" });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">WhatsApp Promotions</h1>
          <p className="mt-1 text-sm text-slate-500">Manage connections and automate your campaigns.</p>
        </div>
        <div className="flex items-center gap-4">
          {waConnected && (
            <button onClick={handleWaReconnect} className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors">
              Disconnect
            </button>
          )}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 ring-1 ring-slate-200">
            <div className={`h-2.5 w-2.5 rounded-full ${waConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span className="text-sm font-bold text-slate-700">{waConnected ? "Connected" : "Not Connected"}</span>
          </div>
        </div>
      </header>

      {/* Monthly Usage stats full width */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Usage</span>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{Math.round((used/limit)*100)}% Used</span>
        </div>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold text-slate-900">{used}</p>
          <p className="text-sm font-medium text-slate-400">/ {limit} Messages</p>
        </div>
        <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${Math.min(100, (used/limit)*100)}%` }} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Connection Status */}
        <div className="lg:col-span-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm h-full">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Connection</h2>
            {!waConnected ? (
              <div className="flex flex-col items-center justify-center py-6">
                {waQrDataUrl ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
                      <Image src={waQrDataUrl} alt="WhatsApp QR" width={200} height={200} className="h-48 w-48" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">Scan QR with WhatsApp</p>
                    <button 
                      onClick={handleWaReconnect} 
                      className="mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Regenerate QR
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="mt-4 text-sm font-bold text-slate-500">Loading QR...</p>
                    <button 
                      onClick={handleWaReconnect} 
                      className="mt-4 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      Stuck? Try Resetting
                    </button>
                  </div>
                )}
                {waLastError && (
                  <div className="space-y-3 flex flex-col items-center">
                    <p className="text-[10px] font-bold text-rose-500 text-center bg-rose-50 p-2 rounded-lg">{waLastError}</p>
                    <button onClick={handleWaReconnect} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-200 hover:border-indigo-600 transition-all">
                      Force Reconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <p className="text-lg font-bold text-slate-900">Connected</p>
                <p className="text-sm text-slate-500 mt-1">Ready for automation</p>
              </div>
            )}
          </section>
        </div>

        {/* Select Recipients */}
        <div className="lg:col-span-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">1. Select Recipients</h2>
              {draftId && <button onClick={() => router.push("/dashboard/leads")} className="text-xs font-bold text-indigo-600 hover:underline">Change Draft</button>}
            </div>
            {!draftId ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center h-[200px]">
                <p className="text-sm font-medium text-slate-500">No leads selected yet.</p>
                <label className="mt-4 cursor-pointer rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-black">
                  {excelUploading ? "Processing..." : "Upload Excel"}
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleExcelUpload(e.target.files?.[0])} disabled={excelUploading} />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-black">{recipients.length}</div>
                  <div>
                    <p className="text-base font-black text-indigo-950 uppercase tracking-tight">{draftCampaignName || "Selected Leads"}</p>
                    <p className="text-xs text-indigo-600 font-bold">Ready to be processed</p>
                  </div>
                </div>
                <div className="max-h-24 overflow-auto rounded-xl bg-slate-50 p-4 text-[10px] text-slate-500 font-mono leading-relaxed">
                  {recipients.slice(0, 10).map(r => r.phone).join(", ")} {recipients.length > 10 ? "and more..." : ""}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Compose & Send full width */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">2. Compose & Send</h2>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Message Template</label>
              <RichTextEditor value={templateText} onChange={setTemplateText} outputMode="text" minHeight={300} disabled={!!jobId} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Action Link (Optional)</label>
              <input className="w-full rounded-2xl border border-slate-100 bg-slate-50/30 px-5 py-4 text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all" value={templateLink} onChange={e => setTemplateLink(e.target.value)} placeholder="https://..." disabled={!!jobId} />
            </div>
            <button 
              onClick={handleBulkSend} disabled={!draftId || !waConnected || !!jobId}
              className="w-full rounded-2xl bg-indigo-600 py-5 text-sm font-black text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 disabled:opacity-50 transform active:scale-[0.98] transition-all uppercase tracking-widest"
            >
              {jobId ? "Campaign Running..." : "Launch Campaign"}
            </button>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Preview</label>
              <div className="rounded-[40px] bg-slate-900 p-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 pointer-events-none" />
                <div className="rounded-3xl bg-white/10 backdrop-blur-md p-6 text-sm text-white leading-relaxed min-h-[250px] border border-white/10">
                  <div dangerouslySetInnerHTML={{ __html: renderTemplatePreviewHtml(previewMessage) }} className="prose prose-invert max-w-none" />
                </div>
              </div>
            </div>

            {jobState.status && (
              <div className="space-y-5 rounded-3xl bg-slate-900 p-8 shadow-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Progress</span>
                  <span className="text-xs font-black text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full">{jobState.sentCount} / {jobState.total}</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-white/5 p-1 ring-1 ring-white/10">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(jobState.sentCount / jobState.total) * 100}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{jobState.status}</p>
                  {jobState.lastWaLink && <a href={jobState.lastWaLink} target="_blank" className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest border-b border-indigo-400/30">View Last Chat</a>}
                </div>
              </div>
            )}

            {sendLogs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campaign Logs</label>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Last 10 activities</span>
                </div>
                <div className="max-h-48 overflow-auto space-y-2 pr-2 custom-scrollbar">
                  {sendLogs.slice(-10).reverse().map((log, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-4 transition-all hover:border-slate-200">
                      <span className="text-xs font-bold text-slate-900">{log.name}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${log.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{log.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
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

"use client";

import { useEffect, useState } from "react";
import SuperAdminShell from "@/components/super-admin-shell";
import { PACKAGE_FEATURES } from "@/lib/constants";

const SUPER_ADMIN_TOKEN = "hardcoded-super-admin-token";

function getEmptyForm() {
  return {
    name: "",
    priceMonthly: "",
    priceYearly: "",
    users: "",
    ordersPerMonth: "",
    courierOrdersPerMonth: "",
    emailsPerMonth: "",
    campaignsPerMonth: "",
    wpPromotionsPerMonth: "",
    features: PACKAGE_FEATURES.reduce((acc, feature) => {
      acc[feature] = false;
      return acc;
    }, {}),
  };
}

export default function SuperAdminPackagesPage() {
  const [form, setForm] = useState(getEmptyForm);
  const [packages, setPackages] = useState([]);
  const [editingPackageId, setEditingPackageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("list"); // "list" or "create"

  async function loadPackages() {
    setLoading(true);
    const response = await fetch("/api/packages");
    const json = await response.json();
    if (!response.ok) {
      setError(json?.message || "Failed to load packages");
      setLoading(false);
      return;
    }
    setPackages(json?.packages || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPackages();
  }, []);

  function startEdit(pkg) {
    setEditingPackageId(pkg._id);
    setForm({
      name: pkg?.name || "",
      priceMonthly: String(pkg?.priceMonthly ?? ""),
      priceYearly: String(pkg?.priceYearly ?? ""),
      users: String(pkg?.limits?.users ?? ""),
      ordersPerMonth: String(pkg?.limits?.orders_per_month ?? ""),
      courierOrdersPerMonth: String(pkg?.limits?.courier_orders_per_month ?? ""),
      emailsPerMonth: String(pkg?.limits?.emails_per_month ?? ""),
      campaignsPerMonth: String(pkg?.limits?.campaigns_per_month ?? ""),
      wpPromotionsPerMonth: String(pkg?.limits?.wp_promotions_per_month ?? ""),
      features: PACKAGE_FEATURES.reduce((acc, feature) => {
        acc[feature] = Boolean(pkg?.features?.[feature]);
        return acc;
      }, {}),
    });
    setMessage("");
    setError("");
    setActiveTab("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingPackageId("");
    setForm(getEmptyForm());
    setMessage("");
    setError("");
    setActiveTab("list");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/packages", {
      method: editingPackageId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        "x-super-admin-token": SUPER_ADMIN_TOKEN,
      },
      body: JSON.stringify({
        packageId: editingPackageId || undefined,
        name: form.name,
        priceMonthly: Number(form.priceMonthly || 0),
        priceYearly: Number(form.priceYearly || 0),
        features: form.features,
        limits: {
          users: Number(form.users || 1),
          orders_per_month: Number(form.ordersPerMonth || 0),
          courier_orders_per_month: Number(form.courierOrdersPerMonth || 0),
          emails_per_month: Number(form.emailsPerMonth || 0),
          campaigns_per_month: Number(form.campaignsPerMonth || 0),
          wp_promotions_per_month: Number(form.wpPromotionsPerMonth || 0),
        },
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json?.message || "Failed to save package");
      setSubmitting(false);
      return;
    }

    setMessage(editingPackageId ? "Package updated successfully" : "Package created successfully");
    setEditingPackageId("");
    setForm(getEmptyForm());
    setSubmitting(false);
    
    // Refresh packages and switch to list
    await loadPackages();
    setTimeout(() => {
        setActiveTab("list");
        setMessage("");
    }, 1500);
  }

  return (
    <SuperAdminShell title="Package Management">
      {/* Tab Navigation */}
      <div className="mb-8 flex gap-4 border-b pb-1">
        <button
          onClick={() => setActiveTab("list")}
          className={`pb-3 text-sm font-bold tracking-tight transition-all outline-none ${
            activeTab === "list"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          View All Packages
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`pb-3 text-sm font-bold tracking-tight transition-all outline-none ${
            activeTab === "create"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {editingPackageId ? "Modify Configuration" : "Deploy New Tier"}
        </button>
      </div>

      {activeTab === "list" ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b p-8 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Subscription Tiers</h2>
              <p className="text-sm text-slate-500 mt-1">Review and manage your product offerings</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-8 py-5">Tier Identity</th>
                    <th className="px-8 py-5 text-right">Pricing Structure</th>
                    <th className="px-8 py-5">Resource Capacity</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-8 py-20 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"></div>
                      </td>
                    </tr>
                  ) : packages.map((pkg) => (
                    <tr key={pkg._id} className="group hover:bg-indigo-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900">{pkg.name}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(pkg?.features || {})
                            .filter(([, enabled]) => enabled)
                            .map(([feature]) => (
                              <span key={feature} className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold uppercase tracking-tight">
                                {feature.split('_')[0]}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-bold text-slate-900">{pkg.priceMonthly} <span className="text-[10px] text-slate-400 font-medium">/mo</span></div>
                        <div className="text-xs text-slate-500 font-medium">{pkg.priceYearly} <span className="text-[10px] opacity-60">/yr</span></div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                          <div className="flex justify-between text-slate-500 gap-4"><span>Users:</span> <span className="font-bold text-slate-900">{pkg?.limits?.users ?? "-"}</span></div>
                          <div className="flex justify-between text-slate-500 gap-4"><span>Orders:</span> <span className="font-bold text-slate-900">{pkg?.limits?.orders_per_month ?? "-"}</span></div>
                          <div className="flex justify-between text-slate-500 gap-4"><span>Emails:</span> <span className="font-bold text-slate-900">{pkg?.limits?.emails_per_month ?? "-"}</span></div>
                          <div className="flex justify-between text-slate-500 gap-4"><span>Promos:</span> <span className="font-bold text-slate-900">{pkg?.limits?.wp_promotions_per_month ?? "-"}</span></div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => startEdit(pkg)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-indigo-600 hover:text-white shadow-sm"
                        >
                          ✎
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
          <div className="rounded-3xl border bg-white shadow-xl shadow-slate-200/50 p-10">
            <h2 className="text-2xl font-bold text-slate-900">
              {editingPackageId ? "Modify Configuration" : "Tier Architecture"}
            </h2>
            <p className="text-sm text-slate-500 mt-2">Define the core parameters and feature accessibility for this tier</p>

            {message && <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-600 border border-emerald-100">{message}</div>}
            {error && <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit} className="mt-10 space-y-8">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Package Name</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      placeholder="e.g. Enterprise Pro"
                      value={form.name}
                      onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Monthly Price</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold outline-none transition-all focus:border-indigo-500 focus:bg-white"
                        type="number"
                        min="0"
                        value={form.priceMonthly}
                        onChange={(event) => setForm((state) => ({ ...state, priceMonthly: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Yearly Price</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold outline-none transition-all focus:border-indigo-500 focus:bg-white"
                        type="number"
                        min="0"
                        value={form.priceYearly}
                        onChange={(event) => setForm((state) => ({ ...state, priceYearly: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 block mb-4">Capacity Limits</label>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Users", key: "users" },
                        { label: "Orders", key: "ordersPerMonth" },
                        { label: "Courier Orders", key: "courierOrdersPerMonth" },
                        { label: "Emails", key: "emailsPerMonth" },
                        { label: "Campaigns", key: "campaignsPerMonth" },
                        { label: "Promos", key: "wpPromotionsPerMonth" },
                      ].map((limit) => (
                        <div key={limit.key}>
                          <div className="text-[10px] font-bold text-slate-500 mb-1.5">{limit.label}</div>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                            type="number"
                            min="1"
                            value={form[limit.key]}
                            onChange={(event) => setForm((state) => ({ ...state, [limit.key]: event.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 block">Feature Accessibility</label>
                  <div className="grid gap-3">
                    {PACKAGE_FEATURES.map((feature) => (
                      <label
                        key={feature}
                        className={`flex items-center justify-between rounded-2xl border p-4 transition-all cursor-pointer ${
                          form.features?.[feature] 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                            : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-100/50"
                        }`}
                      >
                        <span className="text-[11px] font-black uppercase tracking-wider">{feature.replaceAll("_", " ")}</span>
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300 text-indigo-600 accent-indigo-400"
                          checked={Boolean(form.features?.[feature])}
                          onChange={(event) =>
                            setForm((state) => ({
                              ...state,
                              features: {
                                ...state.features,
                                [feature]: event.target.checked,
                              },
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t pt-10">
                <button
                  className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : editingPackageId ? "Apply Configuration" : "Deploy Tier"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-4 text-sm font-bold text-slate-500 transition-all hover:bg-slate-100"
                  onClick={cancelEdit}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}

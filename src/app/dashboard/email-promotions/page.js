"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

export default function DashboardEmailPromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usageData, setUsageData] = useState(null);

  async function loadUsage() {
    setError("");
    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, []);

  const used = Number(usageData?.usage?.emails || 0);
  const limit = Number(usageData?.limits?.emails_per_month || 0);
  const remaining = Math.max(0, limit - used);

  return (
    <CustomerDashboardShell title="Email Promotions">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading email promotions usage...</p>
      ) : (
        <div className="grid gap-4">
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

          <div className="rounded border p-4">
            <h2 className="mb-1 text-sm font-semibold text-zinc-700">How to use this</h2>
            <p className="text-sm text-zinc-600">
              Email promotions are managed through email marketing campaigns.
            </p>
            <div className="mt-3">
              <Link
                href="/dashboard/campaigns"
                className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Go to Campaigns
              </Link>
            </div>
          </div>
        </div>
      )}
    </CustomerDashboardShell>
  );
}


"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const USAGE_FIELDS = [
  { key: "users", label: "Users", limitKey: "users" },
  { key: "orders", label: "Orders", limitKey: "orders_per_month" },
  { key: "courierOrders", label: "Courier Orders", limitKey: "courier_orders_per_month" },
  { key: "emails", label: "Emails", limitKey: "emails_per_month" },
  { key: "campaigns", label: "Campaigns", limitKey: "campaigns_per_month" },
];

export default function DashboardUsagePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usageData, setUsageData] = useState(null);

  useEffect(() => {
    fetch("/api/usage/me", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load usage data");
          setLoading(false);
          return;
        }
        setUsageData(json?.data || null);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load usage data");
        setLoading(false);
      });
  }, []);

  return (
    <CustomerDashboardShell title="Usage">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading usage...</p>
      ) : (
        <div className="grid gap-4">
          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">Current month</p>
            <p className="mt-1 text-xl font-semibold">{usageData?.month || "-"}</p>
          </div>

          <div className="overflow-auto rounded border p-4">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Metric</th>
                  <th className="border p-2">Used</th>
                  <th className="border p-2">Limit</th>
                  <th className="border p-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {USAGE_FIELDS.map((field) => {
                  const used = Number(usageData?.usage?.[field.key] || 0);
                  const limit = Number(usageData?.limits?.[field.limitKey] || 0);
                  const remaining = Math.max(0, limit - used);

                  return (
                    <tr key={field.key}>
                      <td className="border p-2">{field.label}</td>
                      <td className="border p-2">{used}</td>
                      <td className="border p-2">{limit}</td>
                      <td className="border p-2">{remaining}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CustomerDashboardShell>
  );
}

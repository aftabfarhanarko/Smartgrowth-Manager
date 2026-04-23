"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const SUMMARY_CONFIG = [
  { key: "orders", label: "Total Orders", endpoint: "/api/orders" },
  { key: "deliveries", label: "Total Deliveries", endpoint: "/api/deliveries" },
  {
    key: "deliverySuccess",
    label: "Delivery Sent (Success)",
    endpoint: "/api/deliveries",
    statusEquals: "sent",
  },
  { key: "campaigns", label: "Total Campaigns", endpoint: "/api/campaigns" },
  { key: "users", label: "Total Users", endpoint: "/api/users" },
  { key: "emailTemplates", label: "Email Templates", endpoint: "/api/email-promotions/templates" },
  {
    key: "emailsSent",
    label: "Email Sent (Success)",
    endpoint: "/api/usage/me",
    usageKey: "emails",
  },
  {
    key: "wpSent",
    label: "WP Sent (Success)",
    endpoint: "/api/usage/me",
    usageKey: "wpPromotions",
  },
  {
    key: "courierSent",
    label: "Courier Sent (Success)",
    endpoint: "/api/usage/me",
    usageKey: "courierOrders",
  },
];

function formatRelativeTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown time";
  const nowMs = Date.now();
  const diffMs = nowMs - date.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (diffMs < minuteMs) return "Just now";
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)} min ago`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)} hr ago`;
  return `${Math.floor(diffMs / dayMs)} day ago`;
}

function parseItemsFromResponse(configKey, payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (configKey === "emailTemplates" && Array.isArray(payload?.data?.templates)) {
    return payload.data.templates;
  }
  return [];
}

function parseCountFromResponse(config, payload) {
  if (config.usageKey) {
    return Number(payload?.data?.usage?.[config.usageKey] || 0);
  }
  const items = parseItemsFromResponse(config.key, payload);
  if (config.statusEquals) {
    return items.filter((item) => String(item?.status || "") === config.statusEquals).length;
  }
  return items.length;
}

export default function DashboardOverviewPage() {
  const [counts, setCounts] = useState(
    SUMMARY_CONFIG.reduce((acc, item) => ({ ...acc, [item.key]: 0 }), {})
  );
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenantCompany, setTenantCompany] = useState(null);

  useEffect(() => {
    async function loadSummaryAndUpdates() {
      try {
        const meResponse = await fetch("/api/auth/me", { credentials: "include" });
        const meJson = await meResponse.json().catch(() => ({}));
        if (!meResponse.ok || !meJson?.success) {
          setError("Login required to load dashboard data.");
          return;
        }
        setTenantCompany(meJson?.data?.company || null);

        const fetchOpts = { headers: getCustomerHeaders(), credentials: "include" };
        const results = await Promise.all(
          SUMMARY_CONFIG.map(async (config) => {
            const response = await fetch(config.endpoint, fetchOpts);
            const json = await response.json().catch(() => ({}));
            return { config, response, json };
          })
        );

        let allFailed = true;
        const nextCounts = {};
        const updatePool = [];

        results.forEach(({ config, response, json }) => {
          if (!response.ok || !json?.success) {
            nextCounts[config.key] = 0;
            return;
          }

          allFailed = false;
          const items = parseItemsFromResponse(config.key, json);
          nextCounts[config.key] = parseCountFromResponse(config, json);

          const latestItems = items.slice(0, 4);
          latestItems.forEach((item) => {
            const timestamp = item?.updatedAt || item?.createdAt || null;
            const title =
              item?.name || item?.orderNumber || item?.email || item?.customerName || "Updated item";
            updatePool.push({
              id: `${config.key}-${item?._id || `${title}-${timestamp || "na"}`}`,
              title,
              meta: config.label,
              timestamp,
            });
          });
        });

        const sortedUpdates = updatePool
          .sort((a, b) => {
            const aTs = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTs = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTs - aTs;
          })
          .slice(0, 8);

        setCounts(nextCounts);
        setRecentUpdates(sortedUpdates);
        if (allFailed) {
          setError("Login required to load dashboard data.");
        }
      } catch {
        setError("Failed to load dashboard summary.");
      } finally {
        setLoading(false);
      }
    }

    loadSummaryAndUpdates();
  }, []);

  return (
    <CustomerDashboardShell title="Overview">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading overview...</p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-zinc-600">
            {tenantCompany?.name
              ? `All numbers below are for your company: ${tenantCompany.name}.`
              : "All numbers below are scoped to your logged-in company account."}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SUMMARY_CONFIG.map((item) => (
              <div key={item.key} className="rounded border p-4">
                <p className="text-sm text-zinc-500">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold">{counts[item.key] || 0}</p>
              </div>
            ))}
          </div>

          <div className="rounded border p-4">
            <h2 className="text-base font-semibold">Recent Updates</h2>
            {!recentUpdates.length ? (
              <p className="mt-2 text-sm text-zinc-500">No recent updates found.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {recentUpdates.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded bg-zinc-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.meta}</p>
                    </div>
                    <p className="text-xs text-zinc-500">{formatRelativeTime(item.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CustomerDashboardShell>
  );
}

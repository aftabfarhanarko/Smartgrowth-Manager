"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

export default function DashboardOverviewPage() {
  const [ordersCount, setOrdersCount] = useState(0);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/orders", { headers: getCustomerHeaders() }).then((response) => response.json()),
      fetch("/api/deliveries", { headers: getCustomerHeaders() }).then((response) =>
        response.json()
      ),
    ])
      .then(([ordersJson, deliveriesJson]) => {
        if (!ordersJson?.success || !deliveriesJson?.success) {
          setError("Login required to load dashboard data.");
          setLoading(false);
          return;
        }
        setOrdersCount(Array.isArray(ordersJson.data) ? ordersJson.data.length : 0);
        setDeliveriesCount(Array.isArray(deliveriesJson.data) ? deliveriesJson.data.length : 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load dashboard summary.");
        setLoading(false);
      });
  }, []);

  return (
    <CustomerDashboardShell title="Overview">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading overview...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">Total Orders</p>
            <p className="mt-2 text-3xl font-semibold">{ordersCount}</p>
          </div>
          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">Total Deliveries</p>
            <p className="mt-2 text-3xl font-semibold">{deliveriesCount}</p>
          </div>
        </div>
      )}
    </CustomerDashboardShell>
  );
}

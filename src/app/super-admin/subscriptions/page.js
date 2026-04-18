"use client";

import { useEffect, useState } from "react";
import SuperAdminShell from "@/components/super-admin-shell";

const SUPER_ADMIN_TOKEN = "hardcoded-super-admin-token";

export default function SuperAdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSubscriptions() {
    setError("");

    const response = await fetch("/api/super-admin/subscriptions", {
      headers: {
        "x-super-admin-token": SUPER_ADMIN_TOKEN,
      },
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json?.error || "Failed to load subscriptions");
      setLoading(false);
      return;
    }

    setSubscriptions(json?.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/super-admin/subscriptions", {
      headers: {
        "x-super-admin-token": SUPER_ADMIN_TOKEN,
      },
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load subscriptions");
          setLoading(false);
          return;
        }
        setSubscriptions(json?.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load subscriptions");
        setLoading(false);
      });
  }, []);

  async function handleApprove(id) {
    setApprovingId(id);
    setError("");
    setMessage("");

    const response = await fetch(`/api/super-admin/subscriptions/${id}/approve`, {
      method: "POST",
      headers: {
        "x-super-admin-token": SUPER_ADMIN_TOKEN,
      },
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json?.error || "Approve failed");
      setApprovingId("");
      return;
    }

    setMessage("Subscription approved successfully");
    setApprovingId("");
    setLoading(true);
    await loadSubscriptions();
  }

  return (
    <SuperAdminShell title="Subscriptions">
      {message && <p className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading subscriptions...</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100 text-left">
                <th className="border p-2">Company</th>
                <th className="border p-2">Package</th>
                <th className="border p-2">Billing</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Start</th>
                <th className="border p-2">Expire</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription._id}>
                  <td className="border p-2">
                    <p>{subscription?.companyId?.name || "-"}</p>
                    <p className="text-xs text-zinc-500">{subscription?.companyId?.email || "-"}</p>
                  </td>
                  <td className="border p-2">{subscription?.packageId?.name || "-"}</td>
                  <td className="border p-2 capitalize">{subscription.billingType}</td>
                  <td className="border p-2 capitalize">{subscription.status}</td>
                  <td className="border p-2">
                    {subscription.startsAt ? new Date(subscription.startsAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="border p-2">
                    {subscription.expiresAt
                      ? new Date(subscription.expiresAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="border p-2">
                    {subscription.status === "pending" ? (
                      <button
                        className="rounded bg-zinc-900 px-3 py-1 text-xs text-white disabled:opacity-60"
                        onClick={() => handleApprove(subscription._id)}
                        disabled={approvingId === subscription._id}
                        type="button"
                      >
                        {approvingId === subscription._id ? "Approving..." : "Approve"}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SuperAdminShell>
  );
}

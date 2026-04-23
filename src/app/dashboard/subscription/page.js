"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

export default function DashboardSubscriptionPage() {
  const [subscription, setSubscription] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/subscription/me", { headers: getCustomerHeaders() }).then((response) =>
        response.json().then((json) => ({ response, json }))
      ),
      fetch("/api/packages").then((response) =>
        response.json().then((json) => ({ response, json }))
      ),
    ])
      .then(([subscriptionResult, packagesResult]) => {
        if (subscriptionResult.response.ok) {
          const currentSubscription = subscriptionResult?.json?.data || null;
          setSubscription(currentSubscription);
          if (currentSubscription?.packageId?._id) {
            setSelectedPackageId(String(currentSubscription.packageId._id));
          }
        } else {
          setError(subscriptionResult?.json?.error || "No active subscription found");
        }

        if (packagesResult.response.ok) {
          setPackages(packagesResult?.json?.packages || []);
        } else {
          setError((state) => state || packagesResult?.json?.message || "Failed to load packages");
        }

        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load subscription info");
        setLoading(false);
      });
  }, []);

  async function handleUpgradeRequest(event) {
    event.preventDefault();
    if (!selectedPackageId) {
      setError("Please select a package");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/subscription/upgrade", {
      method: "POST",
      headers: getCustomerHeaders(),
      body: JSON.stringify({
        packageId: selectedPackageId,
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json?.error || "Upgrade request failed");
      setSubmitting(false);
      return;
    }

    setMessage(json?.data?.message || "Upgrade request submitted.");
    setSubmitting(false);
  }
<<<<<<< HEAD
=======

>>>>>>> 7a7754f (add new module)
  return (
    <CustomerDashboardShell title="Subscription">
      {loading ? (
        <p className="text-sm text-zinc-500">Loading subscription...</p>
      ) : (
        <div className="grid gap-4">
          {message && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {error && <p className="rounded bg-amber-50 p-3 text-sm text-amber-700">{error}</p>}

          {subscription && (
            <div className="grid gap-3 rounded border p-4 text-sm">
              <p>
                <span className="font-semibold">Package:</span> {subscription?.packageId?.name || "-"}
              </p>
              <p>
                <span className="font-semibold">Billing:</span> {subscription.billingType}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {subscription.status}
              </p>
              <p>
                <span className="font-semibold">Start:</span>{" "}
                {subscription.startsAt ? new Date(subscription.startsAt).toLocaleDateString() : "-"}
              </p>
              <p>
                <span className="font-semibold">Expire:</span>{" "}
                {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : "-"}
              </p>
            </div>
          )}

          <form className="grid gap-3 rounded border p-4" onSubmit={handleUpgradeRequest}>
            <h2 className="text-lg font-semibold">Request Package Upgrade</h2>

            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Select package</span>
              <select
                className="rounded border p-2"
                value={selectedPackageId}
                onChange={(event) => setSelectedPackageId(event.target.value)}
                required
              >
                <option value="">Choose a package</option>
                {packages.map((pkg) => (
                  <option key={pkg._id} value={pkg._id}>
                    {pkg.name} - Monthly: {pkg.priceMonthly} / Yearly: {pkg.priceYearly}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Upgrade Request"}
            </button>
          </form>
        </div>
      )}
    </CustomerDashboardShell>
  );
}

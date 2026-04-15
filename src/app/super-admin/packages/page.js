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

  async function loadPackages() {
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
    fetch("/api/packages")
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.message || "Failed to load packages");
          setLoading(false);
          return;
        }
        setPackages(json?.packages || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load packages");
        setLoading(false);
      });
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
      features: PACKAGE_FEATURES.reduce((acc, feature) => {
        acc[feature] = Boolean(pkg?.features?.[feature]);
        return acc;
      }, {}),
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingPackageId("");
    setForm(getEmptyForm());
    setMessage("");
    setError("");
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
    setLoading(true);
    await loadPackages();
  }

  return (
    <SuperAdminShell title="Packages">
      <form onSubmit={handleSubmit} className="grid gap-3 rounded border p-4">
        <h2 className="text-lg font-semibold">
          {editingPackageId ? "Update Package" : "Create Package"}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded border p-2"
            placeholder="Package name"
            value={form.name}
            onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Monthly price"
            type="number"
            min="0"
            value={form.priceMonthly}
            onChange={(event) =>
              setForm((state) => ({ ...state, priceMonthly: event.target.value }))
            }
          />
          <input
            className="rounded border p-2"
            placeholder="Yearly price"
            type="number"
            min="0"
            value={form.priceYearly}
            onChange={(event) => setForm((state) => ({ ...state, priceYearly: event.target.value }))}
          />
          <input
            className="rounded border p-2"
            placeholder="Users limit"
            type="number"
            min="1"
            value={form.users}
            onChange={(event) => setForm((state) => ({ ...state, users: event.target.value }))}
          />
          <input
            className="rounded border p-2"
            placeholder="Orders/month limit"
            type="number"
            min="0"
            value={form.ordersPerMonth}
            onChange={(event) =>
              setForm((state) => ({ ...state, ordersPerMonth: event.target.value }))
            }
          />
          <input
            className="rounded border p-2"
            placeholder="Courier orders/month limit"
            type="number"
            min="0"
            value={form.courierOrdersPerMonth}
            onChange={(event) =>
              setForm((state) => ({ ...state, courierOrdersPerMonth: event.target.value }))
            }
          />
          <input
            className="rounded border p-2"
            placeholder="Emails/month limit"
            type="number"
            min="0"
            value={form.emailsPerMonth}
            onChange={(event) =>
              setForm((state) => ({ ...state, emailsPerMonth: event.target.value }))
            }
          />
          <input
            className="rounded border p-2"
            placeholder="Campaigns/month limit"
            type="number"
            min="0"
            value={form.campaignsPerMonth}
            onChange={(event) =>
              setForm((state) => ({ ...state, campaignsPerMonth: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium text-zinc-700">Feature access</p>
          <div className="grid gap-2 md:grid-cols-2">
            {PACKAGE_FEATURES.map((feature) => (
              <label
                key={feature}
                className="flex items-center gap-2 rounded border p-2 text-sm text-zinc-700"
              >
                <input
                  type="checkbox"
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
                <span>{feature.replaceAll("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="w-fit rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? editingPackageId
                ? "Updating..."
                : "Creating..."
              : editingPackageId
                ? "Update Package"
                : "Create Package"}
          </button>
          {editingPackageId && (
            <button
              type="button"
              className="w-fit rounded border border-zinc-300 px-4 py-2 text-zinc-700"
              onClick={cancelEdit}
              disabled={submitting}
            >
              Cancel Edit
            </button>
          )}
        </div>
        {message && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      </form>

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Package Table</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading packages...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Monthly</th>
                  <th className="border p-2">Yearly</th>
                  <th className="border p-2">Users</th>
                  <th className="border p-2">Orders/Month</th>
                  <th className="border p-2">Courier/Month</th>
                  <th className="border p-2">Emails/Month</th>
                  <th className="border p-2">Campaigns/Month</th>
                  <th className="border p-2">Features</th>
                  <th className="border p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg._id}>
                    <td className="border p-2">{pkg.name}</td>
                    <td className="border p-2">{pkg.priceMonthly}</td>
                    <td className="border p-2">{pkg.priceYearly}</td>
                    <td className="border p-2">{pkg?.limits?.users ?? "-"}</td>
                    <td className="border p-2">{pkg?.limits?.orders_per_month ?? "-"}</td>
                    <td className="border p-2">{pkg?.limits?.courier_orders_per_month ?? "-"}</td>
                    <td className="border p-2">{pkg?.limits?.emails_per_month ?? "-"}</td>
                    <td className="border p-2">{pkg?.limits?.campaigns_per_month ?? "-"}</td>
                    <td className="border p-2">
                      {Object.entries(pkg?.features || {})
                        .filter(([, enabled]) => enabled)
                        .map(([feature]) => feature.replaceAll("_", " "))
                        .join(", ") || "-"}
                    </td>
                    <td className="border p-2">
                      <button
                        type="button"
                        className="rounded bg-zinc-900 px-3 py-1 text-xs text-white"
                        onClick={() => startEdit(pkg)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}

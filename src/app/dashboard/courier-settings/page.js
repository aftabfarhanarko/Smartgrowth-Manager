"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const COURIER_OPTIONS = [
  { value: "steadfast", label: "Steadfast Courier" },
];

const EMPTY_FORM = {
  id: "",
  courierType: "steadfast",
  apiKey: "",
  secretKey: "",
  baseUrl: "",
  isActive: true,
  isDefault: false,
};

function mapSettingToForm(setting) {
  return {
    id: setting._id ? String(setting._id) : "",
    courierType: setting.courierType || "steadfast",
    apiKey: setting.apiKey || "",
    secretKey: setting.secretKey || "",
    baseUrl: setting.baseUrl || "",
    isActive: Boolean(setting.isActive),
    isDefault: Boolean(setting.isDefault),
  };
}
<<<<<<< HEAD
=======

>>>>>>> master
export default function DashboardCourierSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadSettings() {
    setLoading(true);
    fetch("/api/courier-settings", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load settings");
          setLoading(false);
          return;
        }
        const fetchedSettings = Array.isArray(json?.data) ? json.data : [];
        setSettings(fetchedSettings);

        const selectedSetting =
          fetchedSettings.find((item) => item.courierType === form.courierType) ||
          fetchedSettings.find((item) => item.isDefault) ||
          fetchedSettings[0];

        if (selectedSetting) {
          setForm(mapSettingToForm(selectedSetting));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load settings");
        setLoading(false);
      });
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function handleChange(field, value) {
    if (field === "courierType") {
      const existingSetting = settings.find((item) => item.courierType === value);
      if (existingSetting) {
        setForm(mapSettingToForm(existingSetting));
      } else {
        setForm({ ...EMPTY_FORM, courierType: value });
      }
      return;
    }
<<<<<<< HEAD
=======

>>>>>>> master
    setForm((state) => ({ ...state, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    fetch("/api/courier-settings", {
      method: "PATCH",
      headers: getCustomerHeaders(),
      body: JSON.stringify(form),
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to save setting");
          setSubmitting(false);
          return;
        }
        setMessage("Courier setting saved");
        setSubmitting(false);
        loadSettings();
      })
      .catch(() => {
        setError("Failed to save setting");
        setSubmitting(false);
      });
  }

  return (
    <CustomerDashboardShell title="Courier Settings">
      <form onSubmit={handleSubmit} className="rounded border p-4">
        <h2 className="text-lg font-semibold">Setup Courier</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="rounded border p-2"
            value={form.courierType}
            onChange={(event) => handleChange("courierType", event.target.value)}
          >
            {COURIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="rounded border p-2"
            placeholder="Base URL"
            value={form.baseUrl}
            onChange={(event) => handleChange("baseUrl", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="API Key"
            value={form.apiKey}
            onChange={(event) => handleChange("apiKey", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Secret Key"
            value={form.secretKey}
            onChange={(event) => handleChange("secretKey", event.target.value)}
            required
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => handleChange("isActive", event.target.checked)}
          />
          Active
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => handleChange("isDefault", event.target.checked)}
          />
          Set as default courier
        </label>
        <button
          type="submit"
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save Setting"}
        </button>
      </form>

      {message && <p className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Saved Courier Settings</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading settings...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Courier</th>
                  <th className="border p-2">Base URL</th>
                  <th className="border p-2">API Key</th>
                  <th className="border p-2">Status</th>
                  <th className="border p-2">Default</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((item) => (
                  <tr key={item._id}>
                    <td className="border p-2 capitalize">{item.courierType}</td>
                    <td className="border p-2">{item.baseUrl}</td>
                    <td className="border p-2">{item.apiKey}</td>
                    <td className="border p-2">{item.isActive ? "Active" : "Inactive"}</td>
                    <td className="border p-2">{item.isDefault ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CustomerDashboardShell>
  );
}

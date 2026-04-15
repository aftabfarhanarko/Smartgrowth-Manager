"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    companyName: "",
    companyEmail: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    async function loadPackages() {
      const res = await fetch("/api/packages");
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || "Package load failed");
      } else {
        const list = json?.packages || [];
        setPackages(list);
      }
      setLoadingPackages(false);
    }
    loadPackages();
  }, []);

  async function handleCompanyRegister(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCompanySubmitting(true);

    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...companyForm,
        packageId: selectedPackageId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Company registration failed");
    } else {
      setSuccess("Company registration successful.");
      setCompanyForm({
        companyName: "",
        companyEmail: "",
        phone: "",
        password: "",
      });
    }
    setCompanySubmitting(false);
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section>
          <h1 className="text-3xl font-semibold">Smart Growth Manager</h1>
          <p className="mt-2 text-zinc-600">
            Choose a package, register your company, then create users.
          </p>
        </section>

        {error && <p className="rounded border border-red-200 bg-red-50 p-3">{error}</p>}
        {success && (
          <p className="rounded border border-emerald-200 bg-emerald-50 p-3">{success}</p>
        )}

        <section className="rounded border bg-white p-5">
          <h2 className="text-xl font-semibold">Packages</h2>
          {loadingPackages && <p className="mt-3 text-sm text-zinc-500">Loading packages...</p>}
          {!loadingPackages && packages.length === 0 && (
            <p className="mt-3 text-sm text-zinc-500">No package found.</p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <button
                key={pkg._id}
                type="button"
                className={`rounded-xl border p-4 text-left shadow-sm transition ${
                  selectedPackageId === pkg._id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white hover:border-zinc-400"
                }`}
                onClick={() => {
                  setSelectedPackageId(pkg._id);
                  setSuccess("");
                }}
              >
                <p className="text-lg font-semibold">{pkg.name}</p>
                <p className="mt-2 text-sm">
                  Monthly: {pkg.priceMonthly} | Yearly: {pkg.priceYearly}
                </p>
                <div className="mt-3 space-y-1 text-xs">
                  <p>Users: {pkg?.limits?.users ?? 0}</p>
                  <p>Orders/mo: {pkg?.limits?.orders_per_month ?? 0}</p>
                  <p>Courier/mo: {pkg?.limits?.courier_orders_per_month ?? 0}</p>
                  <p>Emails/mo: {pkg?.limits?.emails_per_month ?? 0}</p>
                  <p>Campaigns/mo: {pkg?.limits?.campaigns_per_month ?? 0}</p>
                </div>
                <p className="mt-3 text-xs">
                  Features:{" "}
                  {Object.entries(pkg?.features || {})
                    .filter(([, enabled]) => enabled)
                    .map(([feature]) => feature.replaceAll("_", " "))
                    .join(", ") || "None"}
                </p>
              </button>
            ))}
          </div>
        </section>

        {selectedPackageId && (
          <section>
            <form className="rounded border bg-white p-5" onSubmit={handleCompanyRegister}>
              <h2 className="text-xl font-semibold">Company Registration</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Selected package ready. Now create your company.
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  className="rounded border p-2"
                  placeholder="Company Name"
                  value={companyForm.companyName}
                  onChange={(e) =>
                    setCompanyForm((state) => ({ ...state, companyName: e.target.value }))
                  }
                  required
                />
                <input
                  className="rounded border p-2"
                  placeholder="Gmail"
                  type="email"
                  value={companyForm.companyEmail}
                  onChange={(e) =>
                    setCompanyForm((state) => ({ ...state, companyEmail: e.target.value }))
                  }
                  required
                />
                <input
                  className="rounded border p-2"
                  placeholder="Password"
                  type="password"
                  value={companyForm.password}
                  onChange={(e) =>
                    setCompanyForm((state) => ({ ...state, password: e.target.value }))
                  }
                  required
                />
                <input
                  className="rounded border p-2"
                  placeholder="Phone Number"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm((state) => ({ ...state, phone: e.target.value }))}
                  required
                />
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
                  disabled={companySubmitting}
                >
                  {companySubmitting ? "Registering..." : "Register Company"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

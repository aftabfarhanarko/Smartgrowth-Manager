"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const EMPTY_FORM = {
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  codAmount: "",
  itemName: "",
  itemQuantity: "1",
  itemPrice: "0",
  notes: "",
};

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");

  function loadOrders() {
    setLoading(true);
    fetch("/api/orders", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load orders");
          setLoading(false);
          return;
        }
        setOrders(Array.isArray(json?.data) ? json.data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load orders");
        setLoading(false);
      });
  }

  useEffect(() => {
    fetch("/api/orders", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load orders");
          setLoading(false);
          return;
        }
        setOrders(Array.isArray(json?.data) ? json.data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load orders");
        setLoading(false);
      });
  }, []);

  function onChange(field, value) {
    setForm((state) => ({ ...state, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    fetch("/api/orders", {
      method: "POST",
      headers: getCustomerHeaders(),
      body: JSON.stringify({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerAddress: form.customerAddress,
        codAmount: Number(form.codAmount || 0),
        orderItems: [
          {
            name: form.itemName.trim(),
            quantity: Math.max(1, Number(form.itemQuantity || 1)),
            price: Math.max(0, Number(form.itemPrice || 0)),
          },
        ],
        notes: form.notes,
      }),
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(async ({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to create order");
          setSubmitting(false);
          return;
        }
        setMessage("Order created successfully");
        setForm(EMPTY_FORM);
        setSubmitting(false);
        loadOrders();
      })
      .catch(() => {
        setError("Failed to create order");
        setSubmitting(false);
      });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleBulkUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setMessage("");
    setUploadFileName(file.name);

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rows.length) {
        setError("No data found in file");
        setUploading(false);
        return;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({ orders: rows }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json?.error || "Bulk upload failed");
        setUploading(false);
        return;
      }

      const createdCount = Number(json?.data?.createdCount || 0);
      const failedCount = Number(json?.data?.failedCount || 0);
      setMessage(`Bulk upload complete: ${createdCount} created, ${failedCount} failed.`);
      if (failedCount > 0) {
        const failedRows = (json?.data?.failedRows || [])
          .slice(0, 5)
          .map((item) => `row ${item.row} (${item.orderNumber || "N/A"})`)
          .join(", ");
        setError(`Some rows failed: ${failedRows}`);
      }
      loadOrders();
    } catch {
      setError("Failed to parse file. Please upload a valid Excel/CSV file.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  return (
    <CustomerDashboardShell title="Orders">
      <form onSubmit={handleSubmit} className="rounded border p-4">
        <h2 className="text-lg font-semibold">Create Order</h2>
        <p className="mt-1 text-sm text-zinc-500">Order number will be auto-generated.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className="rounded border p-2"
            placeholder="Customer name"
            value={form.customerName}
            onChange={(event) => onChange("customerName", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Customer phone"
            value={form.customerPhone}
            onChange={(event) => onChange("customerPhone", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="COD amount"
            type="number"
            min="0"
            value={form.codAmount}
            onChange={(event) => onChange("codAmount", event.target.value)}
            required
          />
          <input
            className="rounded border p-2 md:col-span-2"
            placeholder="Customer address"
            value={form.customerAddress}
            onChange={(event) => onChange("customerAddress", event.target.value)}
            required
          />
          <input
            className="rounded border p-2 md:col-span-2"
            placeholder="Item name"
            value={form.itemName}
            onChange={(event) => onChange("itemName", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Item quantity"
            type="number"
            min="1"
            value={form.itemQuantity}
            onChange={(event) => onChange("itemQuantity", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Item price"
            type="number"
            min="0"
            value={form.itemPrice}
            onChange={(event) => onChange("itemPrice", event.target.value)}
            required
          />
          <textarea
            className="rounded border p-2 md:col-span-2"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={2}
          />
        </div>
        <button
          type="submit"
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </form>

      <div className="mt-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Bulk Upload (Excel/CSV)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload file with columns like: Order Number, Customer Name, Phone, Address, COD.
          Different header naming is auto-detected.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleBulkUpload}
            disabled={uploading}
            className="rounded border p-2 text-sm"
          />
          {uploadFileName && (
            <span className="text-xs text-zinc-500">
              {uploading ? `Uploading ${uploadFileName}...` : `Last file: ${uploadFileName}`}
            </span>
          )}
        </div>
      </div>
      {message && <p className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Order List</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading orders...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Order No</th>
                  <th className="border p-2">Customer</th>
                  <th className="border p-2">Phone</th>
                  <th className="border p-2">Address</th>
                  <th className="border p-2">COD</th>
                  <th className="border p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="border p-2">{order.orderNumber}</td>
                    <td className="border p-2">{order.customerName}</td>
                    <td className="border p-2">{order.customerPhone}</td>
                    <td className="border p-2">{order.customerAddress}</td>
                    <td className="border p-2">{order.codAmount}</td>
                    <td className="border p-2 capitalize">{order.status}</td>
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

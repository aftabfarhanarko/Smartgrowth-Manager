"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "staff",
};

export default function DashboardUsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadUsers() {
    setLoading(true);
    fetch("/api/users", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load users");
          setLoading(false);
          return;
        }
        setUsers(Array.isArray(json?.data) ? json.data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users");
        setLoading(false);
      });
  }

  useEffect(() => {
    fetch("/api/users", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load users");
          setLoading(false);
          return;
        }
        setUsers(Array.isArray(json?.data) ? json.data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users");
        setLoading(false);
      });
  }, []);

  function handleChange(field, value) {
    setForm((state) => ({ ...state, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    fetch("/api/users", {
      method: "POST",
      headers: getCustomerHeaders(),
      body: JSON.stringify(form),
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to create user");
          setSubmitting(false);
          return;
        }
        setMessage("User created successfully");
        setForm(EMPTY_FORM);
        setSubmitting(false);
        loadUsers();
      })
      .catch(() => {
        setError("Failed to create user");
        setSubmitting(false);
      });
  }

  return (
    <CustomerDashboardShell title="Users">
      <form onSubmit={handleSubmit} className="rounded border p-4">
        <h2 className="text-lg font-semibold">Create User</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className="rounded border p-2"
            placeholder="Name"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(event) => handleChange("password", event.target.value)}
            required
          />
          <select
            className="rounded border p-2"
            value={form.role}
            onChange={(event) => handleChange("role", event.target.value)}
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <button
          type="submit"
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create User"}
        </button>
      </form>

      {message && <p className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Users List</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading users...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Email</th>
                  <th className="border p-2">Role</th>
                  <th className="border p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="border p-2">{user.name}</td>
                    <td className="border p-2">{user.email}</td>
                    <td className="border p-2 capitalize">{user.role}</td>
                    <td className="border p-2">{user.isActive ? "Active" : "Inactive"}</td>
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

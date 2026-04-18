"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SUPER_ADMIN_EMAIL = "admin@smartdelivery.com";
const SUPER_ADMIN_PASSWORD = "123456";
const SUPER_ADMIN_TOKEN = "hardcoded-super-admin-token";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("super_admin_token");
    if (token === SUPER_ADMIN_TOKEN) {
      router.replace("/super-admin/packages");
    }
  }, [router]);

  function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (email !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
      setError("Wrong email or password");
      return;
    }

    window.localStorage.setItem("super_admin_token", SUPER_ADMIN_TOKEN);
    router.push("/super-admin/packages");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <form onSubmit={handleLogin} className="w-full max-w-md rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">Super Admin Login</h1>
        <p className="mt-1 text-sm text-zinc-600">Use hardcoded login to enter dashboard.</p>

        {error && <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div className="mt-4 grid gap-3">
          <input
            className="rounded border p-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="rounded bg-zinc-900 px-4 py-2 text-white" type="submit">
            Login
          </button>
        </div>
      </form>
    </main>
  );
}

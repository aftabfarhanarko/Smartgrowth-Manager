"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const SUPER_ADMIN_TOKEN = "hardcoded-super-admin-token";

export default function SuperAdminShell({ title, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const token =
    typeof window === "undefined" ? null : window.localStorage.getItem("super_admin_token");
  const isAuthenticated = token === SUPER_ADMIN_TOKEN;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/super-admin");
    }
  }, [isAuthenticated, router]);

  function handleLogout() {
    window.localStorage.removeItem("super_admin_token");
    router.replace("/super-admin");
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen p-8">Checking admin session...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Super Admin</h2>
          <nav className="mt-4 grid gap-2">
            <Link
              href="/super-admin/packages"
              className={`rounded px-3 py-2 text-sm ${
                pathname === "/super-admin/packages" ? "bg-zinc-900 text-white" : "bg-zinc-100"
              }`}
            >
              Packages
            </Link>
            <Link
              href="/super-admin/subscriptions"
              className={`rounded px-3 py-2 text-sm ${
                pathname === "/super-admin/subscriptions"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100"
              }`}
            >
              Subscriptions
            </Link>
          </nav>
          <button
            className="mt-6 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </aside>
        <section className="rounded-xl border bg-white p-5">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}

import { Suspense } from "react";
import LeadsPageClient from "./leads-page-client";

export default function DashboardLeadsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-50 p-6">
          <p className="text-sm text-zinc-500">Loading…</p>
        </main>
      }
    >
      <LeadsPageClient />
    </Suspense>
  );
}

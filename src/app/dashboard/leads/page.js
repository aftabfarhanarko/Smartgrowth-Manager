"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

export default function DashboardLeadsPage() {
  const searchParams = useSearchParams();
  const initialCampaignId = searchParams.get("campaignId") || "";

  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(initialCampaignId);
  const [leads, setLeads] = useState([]);
  const [count, setCount] = useState(0);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState("");

  const selectedCampaign = campaigns.find((item) => String(item._id) === String(selectedCampaignId)) || null;

  useEffect(() => {
    fetch("/api/campaigns", { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load campaigns");
          setLoadingCampaigns(false);
          return;
        }

        const items = Array.isArray(json?.data) ? json.data : [];
        setCampaigns(items);
        if (!selectedCampaignId && items.length) {
          setSelectedCampaignId(String(items[0]._id));
        }
        setLoadingCampaigns(false);
      })
      .catch(() => {
        setError("Failed to load campaigns");
        setLoadingCampaigns(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setLeads([]);
      setCount(0);
      return;
    }

    setLoadingLeads(true);
    setError("");
    fetch(`/api/campaigns/${selectedCampaignId}/leads`, { headers: getCustomerHeaders() })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to load leads");
          setLoadingLeads(false);
          return;
        }
        setLeads(Array.isArray(json?.data?.leads) ? json.data.leads : []);
        setCount(Number(json?.data?.count || 0));
        setLoadingLeads(false);
      })
      .catch(() => {
        setError("Failed to load leads");
        setLoadingLeads(false);
      });
  }, [selectedCampaignId]);

  const columns = useMemo(() => {
    const allKeys = new Set();
    const ordered = [];

    (selectedCampaign?.fields || []).forEach((field) => {
      const key = String(field?.label || "").trim() || String(field?.key || "").trim();
      if (key && !allKeys.has(key)) {
        allKeys.add(key);
        ordered.push(key);
      }
    });

    leads.forEach((lead) => {
      Object.keys(lead?.answers || {}).forEach((key) => {
        if (!allKeys.has(key)) {
          allKeys.add(key);
          ordered.push(key);
        }
      });
    });
    return ordered;
  }, [leads, selectedCampaign]);

  return (
    <CustomerDashboardShell title="Leads">
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="rounded border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-600">Campaign</label>
          <select
            className="rounded border p-2 text-sm"
            value={selectedCampaignId}
            onChange={(event) => setSelectedCampaignId(event.target.value)}
            disabled={loadingCampaigns}
          >
            {!campaigns.length ? <option value="">No campaigns</option> : null}
            {campaigns.map((campaign) => (
              <option key={campaign._id} value={campaign._id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-zinc-500">Total leads: {count}</span>
        </div>
      </div>

      <div className="mt-4 rounded border p-4">
        {loadingLeads ? (
          <p className="text-sm text-zinc-500">Loading leads...</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border p-2">Submitted At</th>
                  {columns.map((column) => (
                    <th key={column} className="border p-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead._id}>
                    <td className="border p-2">
                      {lead?.submittedAt ? new Date(lead.submittedAt).toLocaleString() : "-"}
                    </td>
                    {columns.map((column) => {
                      const value = lead?.answers?.[column];
                      return (
                        <td key={column} className="border p-2">
                          {Array.isArray(value) ? value.join(", ") : value || "-"}
                        </td>
                      );
                    })}
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

"use client";

import { useEffect, useState } from "react";
import CustomerDashboardShell from "@/components/customer-dashboard-shell";
import { getCustomerHeaders } from "@/components/customer-api";

export default function DashboardDeliveriesPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [courierSettings, setCourierSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [selectedCourierType, setSelectedCourierType] = useState("");
  const [sending, setSending] = useState(false);
  const [trackingDeliveryId, setTrackingDeliveryId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/deliveries", { headers: getCustomerHeaders() }).then((response) =>
        response.json().then((json) => ({ response, json }))
      ),
      fetch("/api/courier-settings", { headers: getCustomerHeaders() }).then((response) =>
        response.json().then((json) => ({ response, json }))
      ),
    ])
      .then(([deliveriesResult, settingsResult]) => {
        if (!deliveriesResult.response.ok) {
          setError(deliveriesResult.json?.error || "Failed to load deliveries");
          setLoading(false);
          return;
        }
        if (!settingsResult.response.ok) {
          setError(settingsResult.json?.error || "Failed to load courier settings");
          setLoading(false);
          return;
        }

        setDeliveries(Array.isArray(deliveriesResult.json?.data) ? deliveriesResult.json.data : []);
        setCourierSettings(
          Array.isArray(settingsResult.json?.data)
            ? settingsResult.json.data.filter((item) => item.isActive)
            : []
        );
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load deliveries");
        setLoading(false);
      });
  }, []);

  function openSendModal(deliveryId) {
    const activeSettings = courierSettings.filter((item) => item.isActive);
    const defaultSetting = activeSettings.find((item) => item.isDefault);

    if (defaultSetting) {
      setSelectedDeliveryId(deliveryId);
      setSelectedCourierType(defaultSetting.courierType);
      setShowModal(false);
      setError("");
      setMessage("");

      fetch(`/api/delivery/send/${deliveryId}`, {
        method: "POST",
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          courierType: defaultSetting.courierType,
        }),
      })
        .then((response) => response.json().then((json) => ({ response, json })))
        .then(({ response, json }) => {
          if (!response.ok) {
            setError(json?.error || "Failed to send to courier");
            return;
          }
          setDeliveries((state) =>
            state.map((delivery) => (delivery._id === json?.data?._id ? json.data : delivery))
          );
          setMessage(`Sent by default courier: ${defaultSetting.courierType}`);
        })
        .catch(() => {
          setError("Failed to send to courier");
        });
      return;
    }

    const firstActive = activeSettings[0];
    if (!firstActive) {
      setError("No active courier settings found. Please configure courier settings first.");
      return;
    }

    setSelectedDeliveryId(deliveryId);
    setSelectedCourierType(firstActive.courierType);
    setShowModal(true);
    setMessage("");
    setError("");
  }

  function closeModal() {
    setShowModal(false);
    setSelectedDeliveryId("");
    setSending(false);
  }

  function sendToCourier() {
    if (!selectedDeliveryId || !selectedCourierType) return;

    setSending(true);
    setError("");
    setMessage("");

    fetch(`/api/delivery/send/${selectedDeliveryId}`, {
      method: "POST",
      headers: getCustomerHeaders(),
      body: JSON.stringify({
        courierType: selectedCourierType,
      }),
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to send to courier");
          setSending(false);
          return;
        }

        setDeliveries((state) =>
          state.map((delivery) => (delivery._id === json?.data?._id ? json.data : delivery))
        );
        setMessage("Delivery sent to courier successfully.");
        closeModal();
      })
      .catch(() => {
        setError("Failed to send to courier");
        setSending(false);
      });
  }

  function extractTrackingStatus(trackingPayload) {
    return (
      trackingPayload?.delivery_status ||
      trackingPayload?.status ||
      trackingPayload?.consignment?.status ||
      trackingPayload?.data?.status ||
      trackingPayload?.current_status ||
      null
    );
  }

  function trackDelivery(deliveryId) {
    setTrackingDeliveryId(deliveryId);
    setError("");
    setMessage("");

    fetch(`/api/delivery/track/${deliveryId}`, {
      method: "POST",
      headers: getCustomerHeaders(),
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (!response.ok) {
          setError(json?.error || "Failed to fetch tracking");
          setTrackingDeliveryId("");
          return;
        }

        const nextTrackingId = json?.data?.trackingId;
        if (nextTrackingId) {
          setDeliveries((state) =>
            state.map((delivery) =>
              delivery._id === deliveryId ? { ...delivery, trackingId: nextTrackingId } : delivery
            )
          );
        }

        const statusText = extractTrackingStatus(json?.data?.tracking);
        const messageText = statusText
          ? `Tracking status: ${statusText}`
          : "Tracking data fetched successfully.";
        setMessage(messageText);
        setTrackingDeliveryId("");
      })
      .catch(() => {
        setError("Failed to fetch tracking");
        setTrackingDeliveryId("");
      });
  }
<<<<<<< HEAD
=======

>>>>>>> master
  return (
    <CustomerDashboardShell title="Deliveries">
      {message && <p className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading deliveries...</p>
      ) : (
        <div className="overflow-auto rounded border p-4">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100 text-left">
                <th className="border p-2">Customer</th>
                <th className="border p-2">Phone</th>
                <th className="border p-2">Address</th>
                <th className="border p-2">COD</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Tracking</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery._id}>
                  <td className="border p-2">{delivery.customerName}</td>
                  <td className="border p-2">{delivery.customerPhone}</td>
                  <td className="border p-2">{delivery.customerAddress}</td>
                  <td className="border p-2">{delivery.codAmount}</td>
                  <td className="border p-2 capitalize">{delivery.status}</td>
                  <td className="border p-2">{delivery.trackingId || "-"}</td>
                  <td className="border p-2">
                    <div className="flex flex-wrap gap-2">
                      {["pending", "failed"].includes(delivery.status) ? (
                        <button
                          type="button"
                          onClick={() => openSendModal(delivery._id)}
                          className="rounded bg-zinc-900 px-3 py-1 text-xs text-white"
                        >
                          Send to Courier
                        </button>
                      ) : null}

                      {delivery.trackingId ? (
                        <button
                          type="button"
                          onClick={() => trackDelivery(delivery._id)}
                          disabled={trackingDeliveryId === delivery._id}
                          className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 disabled:opacity-60"
                        >
                          {trackingDeliveryId === delivery._id ? "Tracking..." : "Track"}
                        </button>
                      ) : null}

                      {!["pending", "failed"].includes(delivery.status) && !delivery.trackingId ? (
                        <span className="text-xs text-zinc-500">No action</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h3 className="text-lg font-semibold">Send to Courier</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Default courier auto selected. You can change before send.
            </p>

            <select
              className="mt-4 w-full rounded border p-2"
              value={selectedCourierType}
              onChange={(event) => setSelectedCourierType(event.target.value)}
            >
              {courierSettings.map((item) => (
                <option key={item._id} value={item.courierType}>
                  {item.courierType}
                  {item.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded border px-3 py-2 text-sm"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendToCourier}
                className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                disabled={sending}
              >
                {sending ? "Sending..." : "Confirm Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerDashboardShell>
  );
}

import React, { useEffect, useState } from "react";
import { API_BASE_URL, ADMIN_HEADER } from "../config";

export default function Admin() {
  const [auditRows, setAuditRows] = useState([]);
  const [alertMsg, setAlertMsg] = useState("");
  const [sending, setSending] = useState(false);

  // Load recent audit logs for quick visibility
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/audit/logs?limit=25`, { headers: ADMIN_HEADER })
      .then((r) => r.json())
      .then((d) => setAuditRows(d.rows || []))
      .catch(() => {});
  }, []);

  async function sendWeatherAlert() {
    if (!alertMsg.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/alerts/weather`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ADMIN_HEADER },
        body: JSON.stringify({ message: alertMsg })
      });
      await r.json().catch(() => ({}));
      alert("Weather alert sent (or queued).");
      setAlertMsg("");
    } catch (e) {
      alert("Failed to send alert.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-page" style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>Admin</h1>

      <section style={{ margin: "16px 0", padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Manual Weather Alert</h2>
        <textarea
          rows={3}
          style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          placeholder="Type an SMS/email message to notify students (e.g. rain policy)…"
          value={alertMsg}
          onChange={(e) => setAlertMsg(e.target.value)}
        />
        <button
          onClick={sendWeatherAlert}
          disabled={sending || !alertMsg.trim()}
          style={{ marginTop: 8, padding: "8px 14px", cursor: sending ? "not-allowed" : "pointer" }}
        >
          {sending ? "Sending…" : "Send Alert"}
        </button>
      </section>

      <section style={{ margin: "16px 0", padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
        {auditRows.length === 0 ? (
          <div>No recent events.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {auditRows.map((row, i) => (
              <li key={i}>
                <code>{row.time || row.created_at || ""}</code> — {row.event || row.message || ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

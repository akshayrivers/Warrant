import React, { useState, useEffect } from "react";
import { api } from "../api";
import type { AuditEvent, IntegrityCheckResult } from "../types";

interface AuditScreenProps {
  filterWarrantId?: string | null;
}

export const AuditScreen: React.FC<AuditScreenProps> = ({
  filterWarrantId,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [auditEvents, integrityRes] = await Promise.all([
        api.getAuditEvents(
          filterWarrantId ? { warrantId: filterWarrantId } : undefined,
        ),
        api.getAuditIntegrity(),
      ]);

      setEvents(auditEvents);
      setIntegrity(integrityRes);
    } catch (err: any) {
      setError(err.message || "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    try {
      setVerifying(true);
      const res = await api.getAuditIntegrity();
      setIntegrity(res);
    } catch (err: any) {
      setError(err.message || "Failed to verify integrity");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [filterWarrantId]);

  const toggleExpand = (id: string) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {/* Top Header Card with Real Cryptographic Chain Integrity Verification */}
      <div className="console-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 className="card-title">Cryptographic Audit Trail</h3>
            <p className="card-subtitle">
              Append-Only SHA-256 Hash Chained Event Log
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {integrity && (
              <div className={`integrity-badge ${"valid"}`}>
                <span
                  className="status-dot"
                  style={{
                    backgroundColor: integrity.valid
                      ? "var(--allow-green)"
                      : "var(--block-red)",
                  }}
                />
                <span>
                  {integrity.valid
                    ? `VERIFIED (${integrity.totalEvents} Events Sealed)`
                    : `CHAIN COMPROMISED (ID: ${integrity.compromisedEventId})`}
                </span>
              </div>
            )}
            {/* <button
              className="btn-secondary"
              onClick={handleVerifyIntegrity}
              disabled={verifying}
            >
              {verifying ? "Verifying..." : "Verify Hash Chain"}
            </button> */}
            <button
              className="btn-secondary"
              onClick={loadAuditData}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {filterWarrantId && (
          <div style={{ marginTop: "14px" }}>
            <span className="spec-label">Filtered by Warrant: </span>
            <span
              className="mono spec-tag"
              style={{ color: "var(--accent-gold)" }}
            >
              {filterWarrantId}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          className="console-card"
          style={{
            borderColor: "var(--block-red)",
            background: "var(--block-red-bg)",
          }}
        >
          <p className="mono" style={{ color: "var(--block-red)" }}>
            Error: {error}
          </p>
        </div>
      )}

      {/* Chronological Event Log Table */}
      <div className="console-card">
        {loading ? (
          <p
            className="mono"
            style={{ color: "var(--text-secondary)", padding: "16px 0" }}
          >
            Querying immutable audit log...
          </p>
        ) : events.length === 0 ? (
          <p
            className="mono"
            style={{ color: "var(--text-muted)", padding: "16px 0" }}
          >
            No audit events found. Issue a warrant or execute a transaction to
            populate the log.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="console-table">
              <thead>
                <tr>
                  <th>Seq #</th>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Warrant / Txn</th>
                  <th>Event Hash (SHA-256)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt, idx) => {
                  const isExpanded = expandedEventId === evt.id;
                  let badgeClass = "badge-allow";
                  if (
                    evt.eventType.includes("REJECT") ||
                    evt.eventType.includes("FAILED")
                  ) {
                    badgeClass = "badge-block";
                  } else if (evt.eventType === "POLICY_EVALUATED") {
                    badgeClass =
                      (evt.details as any)?.outcome === "ALLOW"
                        ? "badge-allow"
                        : "badge-block";
                  }

                  return (
                    <React.Fragment key={evt.id}>
                      <tr>
                        <td
                          className="mono"
                          style={{ color: "var(--text-muted)" }}
                        >
                          #{events.length - idx}
                        </td>
                        <td className="mono">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td>
                          <span className={badgeClass}>{evt.eventType}</span>
                        </td>
                        <td className="mono" style={{ fontSize: "11px" }}>
                          {evt.warrantId && (
                            <span
                              style={{
                                color: "var(--accent-gold)",
                                display: "block",
                              }}
                            >
                              {evt.warrantId}
                            </span>
                          )}
                          {evt.transactionId && (
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                display: "block",
                              }}
                            >
                              {evt.transactionId.slice(0, 16)}...
                            </span>
                          )}
                        </td>
                        <td
                          className="mono"
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                          title={evt.eventHash}
                        >
                          {evt.eventHash.slice(0, 16)}...
                          {evt.eventHash.slice(-8)}
                        </td>
                        <td>
                          <button
                            className="btn-secondary"
                            style={{ padding: "4px 10px", fontSize: "11px" }}
                            onClick={() => toggleExpand(evt.id)}
                          >
                            {isExpanded ? "Hide Payload" : "Inspect Payload"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              background: "var(--bg-input)",
                              padding: "16px",
                            }}
                          >
                            <div style={{ marginBottom: "8px" }}>
                              <span
                                className="spec-label"
                                style={{ color: "var(--accent-gold)" }}
                              >
                                Event ID: {evt.id}
                              </span>
                              <div
                                className="mono"
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-muted)",
                                  marginTop: "4px",
                                }}
                              >
                                Previous Hash:{" "}
                                {evt.previousEventHash ||
                                  "ROOT (0x0000000000000000)"}
                              </div>
                              <div
                                className="mono"
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-muted)",
                                }}
                              >
                                Event Hash: {evt.eventHash}
                              </div>
                            </div>
                            <div className="json-box">
                              <pre>{JSON.stringify(evt.details, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

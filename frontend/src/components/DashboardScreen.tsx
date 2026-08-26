import React, { useState, useEffect } from "react";
import { api } from "../api";
import type { SignedWarrant, TransactionRecord, WarrantWithSpending } from "../types";

interface DashboardScreenProps {
  onNavigateToAgent: (warrantId: string) => void;
  activeWarrantId: string | null;
  setActiveWarrantId: (id: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToAgent,
  activeWarrantId,
  setActiveWarrantId,
}) => {
  const [warrants, setWarrants] = useState<SignedWarrant[]>([]);
  const [warrantData, setWarrantData] = useState<WarrantWithSpending | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch all warrants
      const warrantList = await api.getWarrants();
      setWarrants(warrantList);

      let targetId = activeWarrantId;
      if (!targetId && warrantList.length > 0) {
        targetId = warrantList[0]!.payload.warrantId;
        setActiveWarrantId(targetId);
      }

      // 2. If an active warrant exists, fetch its spending state
      if (targetId) {
        const details = await api.getWarrant(targetId);
        setWarrantData(details);
      } else {
        setWarrantData(null);
      }

      // 3. Fetch recent transactions
      const txList = await api.getTransactions(targetId || undefined);
      setTransactions(txList.slice(0, 5));
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [activeWarrantId]);

  const handleCreateDefaultWarrant = async () => {
    try {
      setIssuing(true);
      setError(null);
      const newWarrant = await api.createWarrant({
        warrantId: `warrant_${Date.now()}`,
        principal: "Akshay (User)",
        agentId: "agent_grocery",
        allowedMerchants: ["freshmart", "techmart"],
        allowedCategories: ["groceries", "electronics"],
        perTransactionLimitMinorUnits: 200000, // ₹2,000.00
        dailyLimitMinorUnits: 500000, // ₹5,000.00
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setActiveWarrantId(newWarrant.payload.warrantId);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message || "Failed to issue warrant");
    } finally {
      setIssuing(false);
    }
  };

  if (loading && !warrantData) {
    return (
      <div className="console-card">
        <p className="mono" style={{ color: "var(--text-secondary)" }}>
          Loading active authorization instruments...
        </p>
      </div>
    );
  }

  const payload = warrantData?.warrant.payload;
  const spending = warrantData?.spending;

  return (
    <div>
      {error && (
        <div
          className="console-card"
          style={{ borderColor: "var(--block-red)", background: "var(--block-red-bg)" }}
        >
          <p className="mono" style={{ color: "var(--block-red)" }}>
            Error: {error}
          </p>
        </div>
      )}

      {/* If no warrants exist */}
      {!payload && (
        <div className="console-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3 className="card-title" style={{ marginBottom: "12px" }}>
            No Active Spending Warrant Found
          </h3>
          <p
            className="mono"
            style={{ color: "var(--text-secondary)", maxWidth: "540px", margin: "0 auto 24px" }}
          >
            A Signed Spending Warrant must be granted before any AI Agent can formulate
            authorized transaction proposals.
          </p>
          <button
            className="btn-primary"
            onClick={handleCreateDefaultWarrant}
            disabled={issuing}
          >
            {issuing ? "Issuing Warrant..." : "Issue Initial Spending Warrant"}
          </button>
        </div>
      )}

      {payload && spending && (
        <>
          {/* Top Row: Active Warrant Instrument & Spending Authority */}
          <div className="grid-2col">
            {/* Active Warrant Instrument */}
            <div className="console-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Active Spending Warrant</h3>
                  <p className="card-subtitle">Cryptographic Authorization Instrument</p>
                </div>
                {warrants.length > 1 && (
                  <select
                    className="select-field"
                    value={payload.warrantId}
                    onChange={(e) => setActiveWarrantId(e.target.value)}
                  >
                    {warrants.map((w) => (
                      <option key={w.payload.warrantId} value={w.payload.warrantId}>
                        {w.payload.warrantId} ({w.payload.principal})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="spec-list">
                <div className="spec-row">
                  <span className="spec-label">Warrant ID</span>
                  <span className="spec-value mono" style={{ color: "var(--accent-gold)" }}>
                    {payload.warrantId}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Grantor (Principal)</span>
                  <span className="spec-value">{payload.principal}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Authorized Agent</span>
                  <span className="spec-value mono">{payload.agentId}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Per-Txn Limit</span>
                  <span className="spec-value mono">
                    ₹{(payload.perTransactionLimit.minorUnits / 100).toFixed(2)}{" "}
                    <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      ({payload.perTransactionLimit.minorUnits} paise)
                    </span>
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Allowed Merchants</span>
                  <div>
                    {payload.allowedMerchants.map((m) => (
                      <span key={m} className="spec-tag">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Allowed Categories</span>
                  <div>
                    {payload.allowedCategories.map((c) => (
                      <span key={c} className="spec-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Instrument Expiry</span>
                  <span className="spec-value mono">
                    {new Date(payload.expiresAt).toLocaleDateString()} {" "}
                    {new Date(payload.expiresAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="spec-row" style={{ borderBottom: "none" }}>
                  <span className="spec-label">HMAC Signature</span>
                  <span
                    className="spec-value mono"
                    style={{ fontSize: "11px", color: "var(--text-muted)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis" }}
                    title={warrantData.warrant.signature}
                  >
                    {warrantData.warrant.signature.slice(0, 24)}...
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button
                  className="btn-primary"
                  onClick={() => onNavigateToAgent(payload.warrantId)}
                  style={{ width: "100%" }}
                >
                  Engage AI Agent with this Warrant →
                </button>
              </div>
            </div>

            {/* Daily Spending Authority & Constraints */}
            <div className="console-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Spending State (Today)</h3>
                  <p className="card-subtitle">Deterministic Cumulative Limit Tracking</p>
                </div>
                <span className="spec-tag" style={{ color: "var(--accent-gold)" }}>
                  {spending.processedTransactionsCount} Processed Txns
                </span>
              </div>

              <div className="grid-3col" style={{ marginBottom: "20px" }}>
                <div className="stat-box">
                  <span className="stat-label">Daily Limit</span>
                  <span className="stat-value mono">
                    ₹{(payload.dailyLimit.minorUnits / 100).toFixed(2)}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Spent Today</span>
                  <span className="stat-value mono" style={{ color: "var(--accent-gold)" }}>
                    ₹{(spending.spentTodayMinorUnits / 100).toFixed(2)}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Remaining</span>
                  <span className="stat-value mono" style={{ color: "var(--allow-green)" }}>
                    ₹{(spending.remainingDailyMinorUnits / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span className="spec-label">Daily Utilization</span>
                  <span className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {payload.dailyLimit.minorUnits > 0
                      ? Math.min(
                          100,
                          Math.round((spending.spentTodayMinorUnits / payload.dailyLimit.minorUnits) * 100)
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${
                        payload.dailyLimit.minorUnits > 0
                          ? Math.min(
                              100,
                              (spending.spentTodayMinorUnits / payload.dailyLimit.minorUnits) * 100
                            )
                          : 0
                      }%`,
                      backgroundColor:
                        spending.spentTodayMinorUnits >= payload.dailyLimit.minorUnits
                          ? "var(--block-red)"
                          : "var(--accent-gold)",
                    }}
                  />
                </div>
              </div>

              <div className="spec-list">
                <div className="spec-row">
                  <span className="spec-label">Replay Cache Size</span>
                  <span className="spec-value mono">{spending.processedTransactionsCount} IDs guarded</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Enforcement Mode</span>
                  <span className="spec-value mono" style={{ color: "var(--allow-green)" }}>
                    DETERMINISTIC STRICT
                  </span>
                </div>
                <div className="spec-row" style={{ borderBottom: "none" }}>
                  <span className="spec-label">Payment Gateway</span>
                  <span className="spec-value mono" style={{ color: "var(--accent-blue)" }}>
                    Razorpay Test Mode
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Decisions Table */}
          <div className="console-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Recent Authorization Decisions</h3>
                <p className="card-subtitle">Last 5 transaction attempts evaluated against policy</p>
              </div>
              <button className="btn-secondary" onClick={loadDashboard}>
                Refresh
              </button>
            </div>

            {transactions.length === 0 ? (
              <p className="mono" style={{ color: "var(--text-muted)", padding: "16px 0" }}>
                No transactions recorded yet for this warrant. Submit an instruction in the Agent tab.
              </p>
            ) : (
              <table className="console-table">
                <thead>
                  <tr>
                    <th>Verdict</th>
                    <th>Timestamp</th>
                    <th>Transaction ID</th>
                    <th>Merchant</th>
                    <th>SKU</th>
                    <th>Amount</th>
                    <th>Reason / Code</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.transactionId}>
                      <td>
                        <span className={tx.outcome === "ALLOW" ? "badge-allow" : "badge-block"}>
                          {tx.outcome}
                        </span>
                      </td>
                      <td className="mono">
                        {new Date(tx.processedAt).toLocaleTimeString()}
                      </td>
                      <td className="mono" style={{ color: "var(--text-muted)" }}>
                        {tx.transactionId.slice(0, 16)}...
                      </td>
                      <td>{tx.merchantId}</td>
                      <td className="mono">{tx.sku}</td>
                      <td className="mono" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        ₹{(tx.amountMinorUnits / 100).toFixed(2)}
                      </td>
                      <td className="mono" style={{ color: tx.outcome === "ALLOW" ? "var(--allow-green)" : "var(--block-red)" }}>
                        {tx.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

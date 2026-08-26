import React, { useState } from "react";
import { api } from "../api";
import type { AgentRunResult, SignedWarrant } from "../types";

interface AgentScreenProps {
  warrantId: string | null;
  warrant: SignedWarrant | null;
  onProceedToDecision: (proposalData: {
    warrantId: string;
    agentId: string;
    merchantId: string;
    category: string;
    sku: string;
    amountMinorUnits: number;
    productName: string;
    signedWarrant?: SignedWarrant;
  }) => void;
}

export const AgentScreen: React.FC<AgentScreenProps> = ({
  warrantId,
  warrant,
  onProceedToDecision,
}) => {
  const [userPrompt, setUserPrompt] = useState("Buy 2L fresh milk from FreshMart");
  const [simulateAttack, setSimulateAttack] = useState<
    "NONE" | "PRICE_TAMPER" | "MERCHANT_SPOOF" | "CATEGORY_SPOOF" | "LIMIT_BYPASS"
  >("NONE");
  const [loading, setLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    "Buy 2L fresh milk from FreshMart",
    "Buy white bread from FreshMart",
    "Buy 12 pack farm fresh eggs",
    "Buy USB-C charging cable from TechMart",
    "Buy premium coffee (out of stock item)",
  ];

  const handleInteract = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!warrantId) {
      setError("Please ensure an active warrant is selected on the Dashboard first.");
      return;
    }
    if (!userPrompt.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setAgentResult(null);

      const result = await api.agentInteract({
        userMessage: userPrompt.trim(),
        warrantId,
        simulateAttack,
      });

      setAgentResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to engage AI agent");
    } finally {
      setLoading(false);
    }
  };

  const proposal = agentResult?.proposal;

  return (
    <div>
      <div className="console-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">AI Commerce Proposer</h3>
            <p className="card-subtitle">
              Untrusted Agent Intent Translation & Proposal Formulation
            </p>
          </div>
          {warrantId && (
            <span className="spec-tag mono" style={{ color: "var(--accent-gold)" }}>
              Operating Under: {warrantId}
            </span>
          )}
        </div>

        <form onSubmit={handleInteract}>
          <div style={{ marginBottom: "16px" }}>
            <label className="spec-label" style={{ display: "block", marginBottom: "8px" }}>
              Natural Language Purchase Intent
            </label>
            <input
              type="text"
              className="text-input-field"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="e.g. Buy 2 litres of fresh milk from FreshMart"
              disabled={loading}
            />

            {/* Presets */}
            <div className="preset-chips">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p}
                  className="preset-chip"
                  onClick={() => setUserPrompt(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Explicit Demo / Attack Simulation Switch */}
          <div
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              padding: "12px 16px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="spec-label" style={{ color: "var(--accent-gold)" }}>
                  Adversarial Demo Switch (Explicit Test Mode Only)
                </span>
                <p className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Injects an adversarial proposal behavior to demonstrate deterministic rejection boundaries.
                </p>
              </div>
              <select
                className="select-field"
                value={simulateAttack}
                onChange={(e) => setSimulateAttack(e.target.value as any)}
                disabled={loading}
              >
                <option value="NONE">NONE (Legitimate Proposer Behavior)</option>
                <option value="PRICE_TAMPER">[ATTACK DEMO] Price Tampering (Claims ₹1.00 for ₹12.84 item)</option>
                <option value="MERCHANT_SPOOF">[ATTACK DEMO] Merchant Spoofing (Targets unapproved merchant)</option>
                <option value="CATEGORY_SPOOF">[ATTACK DEMO] Category Spoofing (Claims false category)</option>
                <option value="LIMIT_BYPASS">[ATTACK DEMO] Limit Bypass (Exceeds warrant per-txn cap)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !userPrompt.trim()}
          >
            {loading ? "Agent Searching Catalog & Formulating Proposal..." : "Submit Intent to Agent"}
          </button>
        </form>
      </div>

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

      {/* Renders actual returned proposal from the agent */}
      {agentResult && (
        <div className="console-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Agent Proposal Response</h3>
              <p className="card-subtitle">Authoritative Result Returned by Agent Engine</p>
            </div>
            <span
              className={proposal ? "badge-allow" : "badge-block"}
              style={{ padding: "4px 10px" }}
            >
              {proposal ? "PROPOSAL FORMULATED" : "NO PROPOSAL"}
            </span>
          </div>

          {/* Agent conversational explanation */}
          <div
            style={{
              padding: "14px 18px",
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              marginBottom: "18px",
            }}
          >
            <span className="spec-label" style={{ display: "block", marginBottom: "4px" }}>
              Agent Proposer Message:
            </span>
            <p style={{ color: "var(--text-primary)", fontSize: "14px" }}>
              {agentResult.responseText}
            </p>
          </div>

          {/* Structured proposal details */}
          {proposal && (
            <>
              <div className="spec-list" style={{ marginBottom: "20px" }}>
                <div className="spec-row">
                  <span className="spec-label">Product Name</span>
                  <span className="spec-value">{proposal.product.name}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Authoritative SKU</span>
                  <span className="spec-value mono">{proposal.product.sku}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Merchant ID</span>
                  <span className="spec-value mono">{proposal.request.merchantId}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Category</span>
                  <span className="spec-value mono">{proposal.request.category}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Proposed Price</span>
                  <span
                    className="spec-value mono"
                    style={{
                      fontSize: "15px",
                      color:
                        simulateAttack === "PRICE_TAMPER"
                          ? "var(--block-red)"
                          : "var(--accent-gold)",
                    }}
                  >
                    ₹{(proposal.request.amount.minorUnits / 100).toFixed(2)}{" "}
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      ({proposal.request.amount.minorUnits} paise)
                    </span>
                  </span>
                </div>
                {simulateAttack === "PRICE_TAMPER" && (
                  <div className="spec-row">
                    <span className="spec-label" style={{ color: "var(--block-red)" }}>
                      Catalog Authoritative Price
                    </span>
                    <span className="spec-value mono" style={{ color: "var(--allow-green)" }}>
                      ₹{(proposal.product.priceMinorUnits / 100).toFixed(2)} (Discrepancy detected)
                    </span>
                  </div>
                )}
              </div>

              {/* Tool Execution Trace */}
              <div style={{ marginBottom: "24px" }}>
                <span className="spec-label" style={{ display: "block", marginBottom: "8px" }}>
                  Underlying Tool Call Trace ({agentResult.toolCalls.length} calls)
                </span>
                <div className="json-box">
                  <pre>{JSON.stringify(agentResult.toolCalls, null, 2)}</pre>
                </div>
              </div>

              {/* Prominent Check Authorization Button */}
              <div style={{ textAlign: "right" }}>
                <button
                  className="btn-primary"
                  style={{ padding: "14px 28px", fontSize: "14px" }}
                  onClick={() =>
                    onProceedToDecision({
                      warrantId: proposal.request.warrantId,
                      agentId: proposal.request.agentId,
                      merchantId: proposal.request.merchantId,
                      category: proposal.request.category,
                      sku: proposal.request.sku,
                      amountMinorUnits: proposal.request.amount.minorUnits,
                      productName: proposal.product.name,
                      signedWarrant: warrant || undefined,
                    })
                  }
                >
                  Check Authorization →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import type {
  ExecuteTransactionResponse,
  ProposalValidation,
  SignedWarrant,
} from "../types";

interface DecisionScreenProps {
  proposalData: {
    warrantId: string;
    agentId: string;
    merchantId: string;
    category: string;
    sku: string;
    amountMinorUnits: number;
    productName: string;
    signedWarrant?: SignedWarrant;
  } | null;
  onNavigateToAudit: (warrantId?: string) => void;
  onReset: () => void;
}

export const DecisionScreen: React.FC<DecisionScreenProps> = ({
  proposalData,
  onNavigateToAudit,
  onReset,
}) => {
  // Step execution state
  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage1Result, setStage1Result] = useState<ProposalValidation | null>(null);

  const [stage2Loading, setStage2Loading] = useState(false);
  const [stage2Result, setStage2Result] = useState<ExecuteTransactionResponse | null>(null);

  const [error, setError] = useState<string | null>(null);
  const hasExecutedRef = useRef<string | null>(null);

  // Real sequential execution trigger
  const runSequentialPipeline = async (force: boolean = false) => {
    if (!proposalData) return;
    const proposalKey = `${proposalData.warrantId}_${proposalData.sku}_${proposalData.amountMinorUnits}`;
    if (!force && hasExecutedRef.current === proposalKey) return;
    hasExecutedRef.current = proposalKey;

    try {
      setError(null);

      // STEP 1: Real call to POST /api/proposals/validate
      setStage1Loading(true);
      setStage1Result(null);
      setStage2Result(null);

      const validationRes = await api.validateProposal({
        merchantId: proposalData.merchantId,
        sku: proposalData.sku,
        category: proposalData.category,
        amountMinorUnits: proposalData.amountMinorUnits,
      });

      setStage1Result(validationRes);
      setStage1Loading(false);

      // STEP 2: Real call to POST /api/transactions/execute
      setStage2Loading(true);

      const execRes = await api.executeTransaction({
        warrantId: proposalData.warrantId,
        agentId: proposalData.agentId,
        merchantId: proposalData.merchantId,
        category: proposalData.category,
        sku: proposalData.sku,
        amountMinorUnits: proposalData.amountMinorUnits,
        signedWarrant: proposalData.signedWarrant,
      });

      setStage2Result(execRes);
      setStage2Loading(false);
    } catch (err: any) {
      setError(err.message || "Pipeline execution failed");
      setStage1Loading(false);
      setStage2Loading(false);
    }
  };

  useEffect(() => {
    if (proposalData) {
      const proposalKey = `${proposalData.warrantId}_${proposalData.sku}_${proposalData.amountMinorUnits}`;
      if (hasExecutedRef.current !== proposalKey) {
        runSequentialPipeline();
      }
    }
  }, [proposalData]);

  if (!proposalData) {
    return (
      <div className="console-card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <h3 className="card-title" style={{ marginBottom: "12px" }}>
          No Active Proposal to Evaluate
        </h3>
        <p className="mono" style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
          Please go to the Agent tab and submit an instruction to formulate a transaction proposal first.
        </p>
        <button className="btn-secondary" onClick={onReset}>
          Go to Agent Screen
        </button>
      </div>
    );
  }

  const decision = stage2Result?.decision;
  const payment = stage2Result?.payment;
  const isAllow = decision?.outcome === "ALLOW";
  const isBlock = decision?.outcome === "BLOCK";

  const allPassedPolicyChecks = [
    { name: "Warrant Signature Integrity", desc: "HMAC-SHA256 cryptographic match against server secret" },
    { name: "Temporal Expiration Window", desc: "Evaluation timestamp strictly prior to expiresAt" },
    { name: "Agent Identity Binding", desc: "Requesting Agent ID matches authorized grantee in warrant" },
    { name: "Merchant Allow-list", desc: "Merchant exists in authorized vendor allow-list" },
    { name: "Category Allow-list", desc: "Product category explicitly permitted by warrant" },
    { name: "Currency Code Validation", desc: "Transaction currency matches warrant specification (INR)" },
    { name: "Per-Transaction Limit", desc: "Transaction amount within per-transaction ceiling" },
    { name: "Cumulative Daily Limit", desc: "Projected daily expenditure within cumulative cap" },
    { name: "Transaction Replay Guard", desc: "Transaction ID unique and not previously processed" },
  ];

  return (
    <div>
      {/* Proposal Summary Bar */}
      <div className="console-card" style={{ padding: "18px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="spec-label" style={{ color: "var(--accent-gold)" }}>
              Evaluating Proposal: {proposalData.productName}
            </span>
            <div className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              SKU: <strong style={{ color: "var(--text-primary)" }}>{proposalData.sku}</strong> |{" "}
              Merchant: <strong style={{ color: "var(--text-primary)" }}>{proposalData.merchantId}</strong> |{" "}
              Amount: <strong style={{ color: "var(--text-primary)" }}>₹{(proposalData.amountMinorUnits / 100).toFixed(2)}</strong> |{" "}
              Warrant: <strong style={{ color: "var(--accent-gold)" }}>{proposalData.warrantId}</strong>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => runSequentialPipeline(true)} disabled={stage1Loading || stage2Loading}>
            Re-evaluate Pipeline
          </button>
        </div>
      </div>

      {error && (
        <div className="console-card" style={{ borderColor: "var(--block-red)", background: "var(--block-red-bg)" }}>
          <p className="mono" style={{ color: "var(--block-red)" }}>Error: {error}</p>
        </div>
      )}

      {/* Sequential Stages */}
      <div className="stage-timeline">
        {/* STAGE 1: Proposal Validation */}
        <div
          className={`stage-step ${
            stage1Loading ? "active" : stage1Result?.valid ? "passed" : stage1Result ? "failed" : ""
          }`}
        >
          <div className="stage-icon-box">
            {stage1Loading ? "..." : stage1Result?.valid ? "✓" : stage1Result ? "✕" : "1"}
          </div>
          <div className="stage-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 className="stage-title">Stage 1: Proposal Validation (Authoritative Catalog Check)</h4>
              <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                POST /api/proposals/validate
              </span>
            </div>
            <p className="stage-description">
              Untrusted agent proposal verified against authoritative merchant catalog (SKU existence, availability, merchant ownership, and true price).
            </p>

            {stage1Loading && (
              <p className="mono" style={{ color: "var(--accent-gold)", marginTop: "8px", fontSize: "12px" }}>
                Querying merchant catalog and verifying SKU/Price match...
              </p>
            )}

            {stage1Result && (
              <div style={{ marginTop: "10px" }}>
                {stage1Result.valid ? (
                  <div className="policy-check-item passed">
                    <span>✓</span>
                    <span>
                      Catalog Match Verified: SKU <strong>{stage1Result.product.sku}</strong> confirmed available at authoritative price ₹{(stage1Result.product.priceMinorUnits / 100).toFixed(2)}.
                    </span>
                  </div>
                ) : (
                  <div className="policy-check-item failed">
                    <span>✕</span>
                    <span>
                      Proposal Rejected: <strong>{stage1Result.reason}</strong> (Catalog discrepancy detected in agent output).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* STAGE 2: Deterministic Policy Engine & Signature Verification */}
        <div
          className={`stage-step ${
            stage2Loading ? "active" : isAllow ? "passed" : isBlock ? "failed" : ""
          }`}
        >
          <div className="stage-icon-box">
            {stage2Loading ? "..." : isAllow ? "✓" : isBlock ? "✕" : "2"}
          </div>
          <div className="stage-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 className="stage-title">Stage 2: Deterministic Policy Authorization & Payment Execution</h4>
              <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                POST /api/transactions/execute
              </span>
            </div>
            <p className="stage-description">
              HMAC signature verification, merchant allow-list, category policy, per-transaction ceiling, cumulative daily limit, and replay protection.
            </p>

            {stage2Loading && (
              <p className="mono" style={{ color: "var(--accent-gold)", marginTop: "8px", fontSize: "12px" }}>
                Evaluating deterministic authorization constraints and executing payment...
              </p>
            )}

            {/* If BLOCK: show the single specific reason returned by the API */}
            {isBlock && (
              <div style={{ marginTop: "12px" }}>
                <div className="policy-check-item failed" style={{ padding: "12px" }}>
                  <span>⛔</span>
                  <div>
                    <strong style={{ display: "block", color: "var(--block-red)" }}>
                      AUTHORIZATION BLOCKED: {decision?.reason}
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      The deterministic policy engine rejected the proposed transaction under the active warrant constraints. No payment was initiated.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* If ALLOW: render all 8 passed policy checks */}
            {isAllow && (
              <div style={{ marginTop: "12px" }}>
                <span className="spec-label" style={{ color: "var(--allow-green)" }}>
                  All 8 Policy Invariants Verified & Satisfied:
                </span>
                <div className="policy-checks-list">
                  {allPassedPolicyChecks.map((chk) => (
                    <div key={chk.name} className="policy-check-item passed">
                      <span style={{ fontWeight: "bold" }}>✓</span>
                      <div>
                        <strong>{chk.name}</strong>
                        <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>
                          {chk.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIGNATURE STAMPED VERDICT MOMENT */}
      {decision && (
        <div className="verdict-seal-container">
          <div className={`verdict-stamp ${decision.outcome === "ALLOW" ? "allow" : "block"}`}>
            <span>VERDICT: {decision.outcome}</span>
            <span className="verdict-subtext">
              {decision.outcome === "ALLOW" ? "OFFICIALLY AUTHORIZED" : `REJECTED: ${decision.reason}`}
            </span>
          </div>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <p className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Transaction ID: <strong style={{ color: "var(--text-primary)" }}>{decision.transactionId}</strong> |{" "}
              Evaluated At: {new Date(decision.evaluatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Payment Receipt (on ALLOW only) */}
      {payment && payment.status === "SUCCESS" && (
        <div
          className="console-card"
          style={{ borderColor: "var(--accent-blue)", background: "rgba(59, 130, 246, 0.04)" }}
        >
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ color: "var(--accent-blue)" }}>
                Razorpay Payment Execution (Test Mode)
              </h3>
              <p className="card-subtitle">Executed only after deterministic policy authorization</p>
            </div>
            <span className="spec-tag" style={{ color: "var(--accent-blue)", borderColor: "var(--accent-blue)" }}>
              TEST MODE SUCCESS
            </span>
          </div>

          <div className="spec-list">
            <div className="spec-row">
              <span className="spec-label">Razorpay Order ID</span>
              <span className="spec-value mono" style={{ color: "var(--accent-blue)" }}>
                {payment.orderId}
              </span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Payment ID</span>
              <span className="spec-value mono" style={{ color: "var(--allow-green)" }}>
                {payment.paymentId}
              </span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Amount Charged</span>
              <span className="spec-value mono">
                ₹{(payment.amount.minorUnits / 100).toFixed(2)} ({payment.amount.minorUnits} paise)
              </span>
            </div>
            <div className="spec-row" style={{ borderBottom: "none" }}>
              <span className="spec-label">Execution Timestamp</span>
              <span className="spec-value mono">{new Date(payment.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
        <button className="btn-secondary" onClick={onReset}>
          ← Formulate Another Intent
        </button>
        <button
          className="btn-primary"
          onClick={() => onNavigateToAudit(proposalData.warrantId)}
        >
          Inspect Cryptographic Audit Trail →
        </button>
      </div>
    </div>
  );
};

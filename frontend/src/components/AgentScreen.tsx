import React, { useState, useRef, useEffect } from "react";
import { api } from "../api";
import type {
  AgentRunResult,
  AutoExecuteResponse,
  ConversationTurn,
  SignedWarrant,
} from "../types";

type AttackMode = "NONE" | "PRICE_TAMPER" | "MERCHANT_SPOOF" | "CATEGORY_SPOOF" | "LIMIT_BYPASS";

interface ChatMessage {
  readonly id: number;
  readonly role: "user" | "agent";
  readonly text: string;
  readonly result?: AgentRunResult;
}

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

let nextMessageId = 1;

export const AgentScreen: React.FC<AgentScreenProps> = ({
  warrantId,
  warrant,
  onProceedToDecision,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [simulateAttack, setSimulateAttack] = useState<AttackMode>("NONE");
  const [autoExecute, setAutoExecute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<AutoExecuteResponse | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const presets = [
    "Buy 2L fresh milk from FreshMart",
    "Also add white bread",
    "I need a USB-C charging cable",
    "Get me some eggs too",
    "Buy premium coffee",
  ];

  const historyFrom = (msgs: ChatMessage[]): ConversationTurn[] =>
    msgs.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), text: m.text }));

  const pushMessage = (msg: Omit<ChatMessage, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: nextMessageId++ }]);
  };

  const handleSend = async (rawText?: string) => {
    const userPrompt = (rawText ?? input).trim();
    if (!warrantId) {
      setError("Please ensure an active warrant is selected on the Dashboard first.");
      return;
    }
    if (!userPrompt || loading) return;

    setInput("");
    setError(null);
    setLoading(true);
    pushMessage({ role: "user", text: userPrompt });
    const history = historyFrom(messages);

    try {
      if (autoExecute) {
        const res = await api.agentAutoExecute({
          userMessage: userPrompt,
          warrantId,
          history,
          simulateAttack,
        });
        setAutoResult(res);
        for (const attempt of res.attempts) {
          if (attempt.pipelineResult && attempt.pipelineResult.decision.outcome === "BLOCK") {
            const reason =
              attempt.pipelineResult.proposalValidation.valid === false
                ? String(attempt.pipelineResult.proposalValidation.reason)
                : attempt.pipelineResult.decision.reason;
            pushMessage({
              role: "agent",
              text: `[Policy Engine BLOCKED my proposal — ${reason}. ${
                attempt.attempt < res.attempts.length ? "Revising my proposal..." : "I cannot authorize this request."
              }] ${attempt.agentResult.responseText}`,
              result:
                attempt.attempt === res.attempts.length
                  ? attempt.agentResult
                  : { ...attempt.agentResult, proposal: undefined },
            });
          } else if (attempt.pipelineResult && attempt.pipelineResult.decision.outcome === "ALLOW") {
            pushMessage({
              role: "agent",
              text: `[Policy Engine ALLOWED the transaction. Payment executed in test mode.] ${attempt.agentResult.responseText}`,
              result: attempt.agentResult,
            });
          } else {
            pushMessage({ role: "agent", text: attempt.agentResult.responseText, result: attempt.agentResult });
          }
        }
      } else {
        const result = await api.agentInteract({
          userMessage: userPrompt,
          warrantId,
          history,
          simulateAttack,
        });
        pushMessage({ role: "agent", text: result.responseText, result });
      }
    } catch (err: any) {
      setError(err.message || "Failed to engage AI agent");
    } finally {
      setLoading(false);
    }
  };

  const latestProposal = [...messages].reverse().find((m) => m.result?.proposal)?.result?.proposal;
  const showProposalCard = latestProposal !== undefined && !loading;

  return (
    <div>
      <div className="console-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">AI Commerce Proposer</h3>
            <p className="card-subtitle">
              Gemini-Powered Intent Extraction & Proposal Formulation • Untrusted Proposer Boundary
            </p>
          </div>
          {warrantId && (
            <span className="spec-tag mono" style={{ color: "var(--accent-gold)" }}>
              Operating Under: {warrantId}
            </span>
          )}
        </div>

        {/* Adversarial demo switch + auto-execute toggle */}
        <div
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <span className="spec-label" style={{ color: "var(--accent-gold)" }}>
              Adversarial Demo Switch (Explicit Test Mode Only)
            </span>
            <p className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Injects adversarial proposal behavior to demonstrate deterministic rejection boundaries.
            </p>
          </div>
          <select
            className="select-field"
            value={simulateAttack}
            onChange={(e) => setSimulateAttack(e.target.value as AttackMode)}
            disabled={loading}
            style={{ maxWidth: "340px" }}
          >
            <option value="NONE">NONE (Legitimate Proposer Behavior)</option>
            <option value="PRICE_TAMPER">[ATTACK DEMO] Price Tampering</option>
            <option value="MERCHANT_SPOOF">[ATTACK DEMO] Merchant Spoofing</option>
            <option value="CATEGORY_SPOOF">[ATTACK DEMO] Category Spoofing</option>
            <option value="LIMIT_BYPASS">[ATTACK DEMO] Limit Bypass</option>
          </select>
          <label
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "11px",
              color: autoExecute ? "var(--accent-gold)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={autoExecute}
              onChange={(e) => setAutoExecute(e.target.checked)}
              disabled={loading}
            />
            AUTO-EXECUTE PIPELINE (policy feedback loop)
          </label>
        </div>

        {/* Chat transcript */}
        <div
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            padding: "16px",
            marginBottom: "16px",
            minHeight: "220px",
            maxHeight: "420px",
            overflowY: "auto",
          }}
        >
          {messages.length === 0 && !loading && (
            <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              Describe what you want to buy. The agent will extract your intent, search the catalog,
              and formulate a transaction proposal for independent authorization.
            </p>
          )}

          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: "14px" }}>
              <div
                className="mono"
                style={{
                  fontSize: "10px",
                  color: m.role === "user" ? "var(--text-muted)" : "var(--accent-gold)",
                  marginBottom: "4px",
                  letterSpacing: "0.5px",
                }}
              >
                {m.role === "user" ? "YOU" : "AGENT PROPOSER"}
                {m.result && (
                  <span style={{ marginLeft: "8px", opacity: 0.7 }}>[{m.result.engine}]</span>
                )}
              </div>
              <div
                style={{
                  background: m.role === "user" ? "transparent" : "var(--bg-raised)",
                  border: m.role === "user" ? "none" : "1px solid var(--border-subtle)",
                  borderLeft: m.role === "user" ? "2px solid var(--border-subtle)" : "2px solid var(--accent-gold)",
                  padding: m.role === "user" ? "0 0 0 10px" : "10px 14px",
                  borderRadius: "4px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <p className="mono" style={{ color: "var(--accent-gold)", fontSize: "12px" }}>
              Agent working: extracting intent → searching catalog → formulating proposal...
            </p>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Preset chips */}
        <div className="preset-chips" style={{ marginBottom: "12px" }}>
          {presets.map((p) => (
            <button type="button" key={p} className="preset-chip" onClick={() => void handleSend(p)} disabled={loading}>
              {p}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          style={{ display: "flex", gap: "10px" }}
        >
          <input
            type="text"
            className="text-input-field"
            style={{ flex: 1 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "Buy 2 litres of milk" or "actually make it bread instead"'
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
            {loading ? "Working..." : "Send"}
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

      {/* Auto-execute pipeline trace */}
      {autoResult && (
        <div className="console-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Authorization Pipeline Trace</h3>
              <p className="card-subtitle">
                Deterministic Policy Evaluation with Agent Feedback Loop ({autoResult.attempts.length}{" "}
                {autoResult.attempts.length === 1 ? "attempt" : "attempts"})
              </p>
            </div>
            <span
              className={autoResult.finalOutcome === "ALLOWED" ? "badge-allow" : "badge-block"}
              style={{ padding: "4px 10px" }}
            >
              {autoResult.finalOutcome}
              {autoResult.revised ? " AFTER REVISION" : ""}
            </span>
          </div>

          {autoResult.attempts.map((a) => (
            <div
              key={a.attempt}
              style={{
                border: "1px solid var(--border-subtle)",
                borderLeft:
                  a.pipelineResult?.decision.outcome === "ALLOW"
                    ? "3px solid var(--allow-green)"
                    : "3px solid var(--block-red)",
                borderRadius: "4px",
                padding: "12px 16px",
                marginBottom: "10px",
              }}
            >
              <div className="spec-row">
                <span className="spec-label">Attempt #{a.attempt}</span>
                <span
                  className={`mono spec-value ${a.pipelineResult?.decision.outcome === "ALLOW" ? "" : ""}`}
                  style={{
                    color: a.pipelineResult?.decision.outcome === "ALLOW" ? "var(--allow-green)" : "var(--block-red)",
                  }}
                >
                  {a.pipelineResult ? a.pipelineResult.decision.outcome : "NO PROPOSAL"}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Proposed Amount</span>
                <span className="spec-value mono">
                  ₹{((a.agentResult.proposal?.request.amount.minorUnits ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              {a.pipelineResult && a.pipelineResult.decision.outcome === "BLOCK" && (
                <div className="spec-row">
                  <span className="spec-label" style={{ color: "var(--block-red)" }}>
                    Block Reason (fed back to agent)
                  </span>
                  <span className="spec-value mono" style={{ color: "var(--block-red)" }}>
                    {a.pipelineResult.proposalValidation.valid === false
                      ? String(a.pipelineResult.proposalValidation.reason)
                      : a.pipelineResult.decision.reason}
                  </span>
                </div>
              )}
              <details style={{ marginTop: "8px" }}>
                <summary className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", cursor: "pointer" }}>
                  Tool call trace ({a.agentResult.toolCalls.length} calls)
                </summary>
                <div className="json-box" style={{ marginTop: "6px" }}>
                  <pre>{JSON.stringify(a.agentResult.toolCalls, null, 2)}</pre>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Latest proposal card */}
      {!autoResult && showProposalCard && latestProposal && (
        <div className="console-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Agent Proposal Response</h3>
              <p className="card-subtitle">Authoritative Result Returned by Agent Engine</p>
            </div>
            <span className="badge-allow" style={{ padding: "4px 10px" }}>
              PROPOSAL FORMULATED
            </span>
          </div>

          <div className="spec-list" style={{ marginBottom: "20px" }}>
            <div className="spec-row">
              <span className="spec-label">Product Name</span>
              <span className="spec-value">{latestProposal.product.name}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Authoritative SKU</span>
              <span className="spec-value mono">{latestProposal.product.sku}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Merchant ID</span>
              <span className="spec-value mono">{latestProposal.request.merchantId}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Category</span>
              <span className="spec-value mono">{latestProposal.request.category}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Proposed Price</span>
              <span
                className="spec-value mono"
                style={{
                  fontSize: "15px",
                  color: simulateAttack === "PRICE_TAMPER" ? "var(--block-red)" : "var(--accent-gold)",
                }}
              >
                ₹{(latestProposal.request.amount.minorUnits / 100).toFixed(2)}{" "}
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  ({latestProposal.request.amount.minorUnits} paise)
                </span>
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <button
              className="btn-primary"
              style={{ padding: "14px 28px", fontSize: "14px" }}
              onClick={() =>
                onProceedToDecision({
                  warrantId: latestProposal.request.warrantId,
                  agentId: latestProposal.request.agentId,
                  merchantId: latestProposal.request.merchantId,
                  category: latestProposal.request.category,
                  sku: latestProposal.request.sku,
                  amountMinorUnits: latestProposal.request.amount.minorUnits,
                  productName: latestProposal.product.name,
                  signedWarrant: warrant || undefined,
                })
              }
            >
              Check Authorization →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

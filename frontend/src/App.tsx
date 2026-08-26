import React, { useState, useEffect } from "react";
import "./App.css";
import { DashboardScreen } from "./components/DashboardScreen";
import { AgentScreen } from "./components/AgentScreen";
import { DecisionScreen } from "./components/DecisionScreen";
import { AuditScreen } from "./components/AuditScreen";
import type { SignedWarrant } from "./types";
import { api } from "./api";

type Screen = "DASHBOARD" | "AGENT" | "DECISION" | "AUDIT";

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<Screen>("DASHBOARD");
  const [activeWarrantId, setActiveWarrantId] = useState<string | null>(null);
  const [activeWarrant, setActiveWarrant] = useState<SignedWarrant | null>(null);
  const [activeProposal, setActiveProposal] = useState<{
    warrantId: string;
    agentId: string;
    merchantId: string;
    category: string;
    sku: string;
    amountMinorUnits: number;
    productName: string;
    signedWarrant?: SignedWarrant;
  } | null>(null);

  // Load warrant details when activeWarrantId changes
  useEffect(() => {
    if (activeWarrantId) {
      api
        .getWarrant(activeWarrantId)
        .then((res) => setActiveWarrant(res.warrant))
        .catch(() => setActiveWarrant(null));
    }
  }, [activeWarrantId]);

  // Keyboard navigation shortcuts (1: Dashboard, 2: Agent, 3: Decision, 4: Audit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "1") setActiveScreen("DASHBOARD");
      else if (e.key === "2") setActiveScreen("AGENT");
      else if (e.key === "3") setActiveScreen("DECISION");
      else if (e.key === "4") setActiveScreen("AUDIT");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavigateToAgent = (warrantId: string) => {
    setActiveWarrantId(warrantId);
    setActiveScreen("AGENT");
  };

  const handleProceedToDecision = (proposalData: {
    warrantId: string;
    agentId: string;
    merchantId: string;
    category: string;
    sku: string;
    amountMinorUnits: number;
    productName: string;
    signedWarrant?: SignedWarrant;
  }) => {
    setActiveProposal(proposalData);
    setActiveScreen("DECISION");
  };

  const handleResetToAgent = () => {
    setActiveProposal(null);
    setActiveScreen("AGENT");
  };

  return (
    <div className="app-container">
      {/* Console Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo-mark">W</div>
          <div>
            <h1 className="brand-title">WARRANT</h1>
            <p className="brand-subtitle">
              Deterministic Authorization Console • Agentic Commerce
            </p>
          </div>
        </div>

        <div className="header-right">
          <div className="system-status-pill">
            <span className="status-dot" />
            <span>POLICY ENGINE: DETERMINISTIC</span>
          </div>
          <div className="system-status-pill">
            <span
              className="status-dot"
              style={{ background: "var(--accent-blue)", boxShadow: "0 0 8px var(--accent-blue)" }}
            />
            <span>RAZORPAY: TEST MODE</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeScreen === "DASHBOARD" ? "active" : ""}`}
          onClick={() => setActiveScreen("DASHBOARD")}
        >
          <span className="tab-num">[1]</span> DASHBOARD
        </button>
        <button
          className={`nav-tab-btn ${activeScreen === "AGENT" ? "active" : ""}`}
          onClick={() => setActiveScreen("AGENT")}
        >
          <span className="tab-num">[2]</span> AGENT
        </button>
        <button
          className={`nav-tab-btn ${activeScreen === "DECISION" ? "active" : ""}`}
          onClick={() => setActiveScreen("DECISION")}
        >
          <span className="tab-num">[3]</span> DECISION
        </button>
        <button
          className={`nav-tab-btn ${activeScreen === "AUDIT" ? "active" : ""}`}
          onClick={() => setActiveScreen("AUDIT")}
        >
          <span className="tab-num">[4]</span> AUDIT TRAIL
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {activeScreen === "DASHBOARD" && (
          <DashboardScreen
            onNavigateToAgent={handleNavigateToAgent}
            activeWarrantId={activeWarrantId}
            setActiveWarrantId={setActiveWarrantId}
          />
        )}

        {activeScreen === "AGENT" && (
          <AgentScreen
            warrantId={activeWarrantId}
            warrant={activeWarrant}
            onProceedToDecision={handleProceedToDecision}
          />
        )}

        {activeScreen === "DECISION" && (
          <DecisionScreen
            proposalData={activeProposal}
            onNavigateToAudit={() => setActiveScreen("AUDIT")}
            onReset={handleResetToAgent}
          />
        )}

        {activeScreen === "AUDIT" && (
          <AuditScreen filterWarrantId={activeWarrantId} />
        )}
      </main>
    </div>
  );
};

export default App;

import type { Role } from "../config/types";

interface Props {
  role: Role;
}

export function InfoPanel({ role }: Props) {
  return (
    <div className="panel info-panel">
      <div className="panel-header">
        <h2>How It Works</h2>
      </div>
      <div className="panel-body">
        <div className="info-cards">
          <div className={`info-card ${role === "studio" ? "highlight" : ""}`}>
            <h3>Studio Owner</h3>
            <p>Creates project, locks budget in contract, adds milestones, assigns developers, approves work, releases payments.</p>
          </div>
          <div className={`info-card ${role === "developer" ? "highlight" : ""}`}>
            <h3>Developer</h3>
            <p>Receives project assignment, submits milestones when complete, gets paid automatically on approval, builds on-chain reputation.</p>
          </div>
          <div className={`info-card ${role === "client" ? "highlight" : ""}`}>
            <h3>Client</h3>
            <p>Funds the project, can track all milestones and payments transparently on the blockchain. No trust needed — the contract enforces everything.</p>
          </div>
        </div>
        <p className="info-hint">
          Select a project on the left to see milestones and take actions. Switch roles using the buttons at the top to experience each party's view.
        </p>
      </div>
    </div>
  );
}

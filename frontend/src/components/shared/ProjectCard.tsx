import { ethers } from "ethers";
import type { Project } from "../../config/types";
import { ProjectStatus } from "../../config/types";

const STATUS_LABELS: Record<number, string> = {
  [ProjectStatus.Active]: "Active",
  [ProjectStatus.Completed]: "Completed",
  [ProjectStatus.Disputed]: "Disputed",
  [ProjectStatus.Cancelled]: "Cancelled",
};

const STATUS_CLASSES: Record<number, string> = {
  [ProjectStatus.Active]: "status-active",
  [ProjectStatus.Completed]: "status-completed",
  [ProjectStatus.Disputed]: "status-disputed",
  [ProjectStatus.Cancelled]: "status-cancelled",
};

interface Props {
  project: Project;
  selected: boolean;
  onClick: () => void;
  showFundingBar?: boolean;
  clientFunded?: bigint;
}

export function ProjectCard({ project: p, selected, onClick, showFundingBar, clientFunded }: Props) {
  const fundingPct = showFundingBar && clientFunded !== undefined && p.budget > 0n
    ? Number((clientFunded * 100n) / p.budget)
    : 0;

  return (
    <div
      className={`project-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="project-card-header">
        <h3>{p.title}</h3>
        <span className={`status-badge ${STATUS_CLASSES[p.status]}`}>
          {STATUS_LABELS[p.status]}
        </span>
      </div>
      <p className="project-desc">{p.description}</p>
      <div className="project-meta">
        <span>Budget: {ethers.formatEther(p.budget)} ETH</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {Number(p.approvedCount)} / {Number(p.milestoneCount)} milestones
          {p.milestoneCount > 0n && p.status === ProjectStatus.Active && (
            <span className="health-dot" title={`${Math.round(Number(p.approvedCount * 100n / p.milestoneCount))}% complete`}
              style={{
                width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                background: Number(p.approvedCount) === 0 ? "var(--yellow)" :
                  Number(p.approvedCount) === Number(p.milestoneCount) ? "var(--green)" : "var(--blue)",
              }}
            />
          )}
          {p.status === ProjectStatus.Disputed && (
            <span style={{ fontSize: 11, color: "var(--red)" }} title="Project is disputed">!</span>
          )}
        </span>
      </div>
      {p.developer !== ethers.ZeroAddress && (
        <div className="project-dev">
          Dev: {p.developer.slice(0, 6)}...{p.developer.slice(-4)}
        </div>
      )}
      {showFundingBar && fundingPct > 0 && (
        <div className="funding-bar-wrap">
          <div className="funding-bar" style={{ width: `${Math.min(fundingPct, 100)}%` }} />
          <span className="funding-label">{fundingPct}% client funded</span>
        </div>
      )}
    </div>
  );
}

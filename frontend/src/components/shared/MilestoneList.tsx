import { ethers } from "ethers";
import type { Milestone, Project, Role } from "../../config/types";
import { MilestoneStatus } from "../../config/types";

const MS_STATUS_LABELS: Record<number, string> = {
  [MilestoneStatus.Pending]: "Pending",
  [MilestoneStatus.Submitted]: "Submitted",
  [MilestoneStatus.Approved]: "Approved",
  [MilestoneStatus.Disputed]: "Disputed",
};

const MS_STATUS_CLASSES: Record<number, string> = {
  [MilestoneStatus.Pending]: "ms-pending",
  [MilestoneStatus.Submitted]: "ms-submitted",
  [MilestoneStatus.Approved]: "ms-approved",
  [MilestoneStatus.Disputed]: "ms-disputed",
};

interface Props {
  milestones: Milestone[];
  project: Project;
  role: Role;
  account: string;
  actionLoading: string | null;
  onSubmit?: (index: number) => void;
  onApprove?: (index: number) => void;
}

export function MilestoneList({ milestones, project, role, account, actionLoading, onSubmit, onApprove }: Props) {
  const isStudio = role === "studio";
  const isDev = role === "developer";
  const isAssignedDev = project.developer.toLowerCase() === account.toLowerCase();

  if (milestones.length === 0) {
    return <div className="empty-state">No milestones yet</div>;
  }

  return (
    <div className="milestone-list">
      {milestones.map((ms, i) => (
        <div key={i} className={`milestone-card ${MS_STATUS_CLASSES[ms.status]}`}>
          <div className="ms-header">
            <span className="ms-index">#{i + 1}</span>
            <span className="ms-title">{ms.title}</span>
            <span className={`ms-badge ${MS_STATUS_CLASSES[ms.status]}`}>
              {MS_STATUS_LABELS[ms.status]}
            </span>
          </div>
          <div className="ms-meta">
            <span>{ethers.formatEther(ms.value)} ETH</span>
            <span>Due: {new Date(Number(ms.deadline) * 1000).toLocaleDateString()}</span>
          </div>
          <div className="ms-actions">
            {isDev && isAssignedDev && ms.status === MilestoneStatus.Pending && onSubmit && (
              <button
                className="btn btn-primary btn-sm"
                disabled={!!actionLoading}
                onClick={() => onSubmit(i)}
              >
                {actionLoading === `submit-${i}` ? "Submitting..." : "Submit"}
              </button>
            )}
            {isStudio && ms.status === MilestoneStatus.Submitted && onApprove && (
              <button
                className="btn btn-success btn-sm"
                disabled={!!actionLoading}
                onClick={() => onApprove(i)}
              >
                {actionLoading === `approve-${i}` ? "Approving..." : "Approve & Pay"}
              </button>
            )}
            {ms.status === MilestoneStatus.Approved && (
              <span className="paid-label">Paid</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

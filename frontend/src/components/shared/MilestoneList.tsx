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

function formatDeadline(deadlineTimestamp: bigint): { dateStr: string; countdown: string; urgencyClass: string } {
  const deadlineMs = Number(deadlineTimestamp) * 1000;
  const now = Date.now();
  const diff = deadlineMs - now;

  const dateStr = new Date(deadlineMs).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }) + " UTC";

  if (diff <= 0) {
    const overdueDays = Math.floor(-diff / 86400000);
    return { dateStr, countdown: overdueDays > 0 ? `Overdue ${overdueDays}d` : "Overdue", urgencyClass: "deadline-overdue" };
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);

  if (days > 7) {
    return { dateStr, countdown: `${days}d left`, urgencyClass: "deadline-safe" };
  } else if (days >= 1) {
    return { dateStr, countdown: `${days}d ${hours}h left`, urgencyClass: "deadline-warning" };
  } else {
    return { dateStr, countdown: `${hours}h left`, urgencyClass: "deadline-urgent" };
  }
}

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
      {milestones.map((ms, i) => {
        // Skip removed milestones (value = 0)
        if (ms.value === 0n) return null;

        const { dateStr, countdown, urgencyClass } = formatDeadline(ms.deadline);
        const showCountdown = ms.status === MilestoneStatus.Pending || ms.status === MilestoneStatus.Submitted;

        return (
          <div key={i} className={`milestone-card ${MS_STATUS_CLASSES[ms.status]}`}>
            <div className="ms-header">
              <span className="ms-index">#{i + 1}</span>
              <span className="ms-title">{ms.title}</span>
              <span className={`ms-badge ${MS_STATUS_CLASSES[ms.status]}`} role="status" aria-label={`Milestone status: ${MS_STATUS_LABELS[ms.status]}`}>
                {MS_STATUS_LABELS[ms.status]}
              </span>
            </div>
            <div className="ms-meta">
              <span>{ethers.formatEther(ms.value)} ETH</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{dateStr}</span>
                {showCountdown && (
                  <span className={`deadline-badge ${urgencyClass}`}>{countdown}</span>
                )}
              </span>
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
        );
      })}
    </div>
  );
}

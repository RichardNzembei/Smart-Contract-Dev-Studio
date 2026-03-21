import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type { Project, Milestone, Role } from "../config/types";
import { ProjectStatus, MilestoneStatus } from "../config/types";

interface Props {
  projectId: bigint;
  role: Role;
  account: string;
  getProject: (id: bigint) => Promise<Project>;
  getMilestone: (projectId: bigint, index: bigint) => Promise<Milestone>;
  submitMilestone: (projectId: bigint, index: bigint) => Promise<void>;
  approveMilestone: (projectId: bigint, index: bigint) => Promise<void>;
  raiseDispute: (projectId: bigint) => Promise<void>;
  resolveDispute: (projectId: bigint, inFavorOfDev: boolean) => Promise<void>;
  rateDeveloper: (projectId: bigint, rating: number) => Promise<void>;
  assignDeveloper: (projectId: bigint, devAddress: string) => Promise<void>;
  addMilestone: (projectId: bigint, title: string, value: bigint, deadline: bigint) => Promise<void>;
  onRefresh: () => void;
  refreshKey: number;
}

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

export function ProjectDetail({
  projectId,
  role,
  account,
  getProject,
  getMilestone,
  submitMilestone,
  approveMilestone,
  raiseDispute,
  resolveDispute,
  rateDeveloper,
  assignDeveloper,
  addMilestone,
  onRefresh,
  refreshKey,
}: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [devAddress, setDevAddress] = useState("");
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msValue, setMsValue] = useState("");
  const [msDays, setMsDays] = useState("30");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = await getProject(projectId);
      setProject(p);
      const ms: Milestone[] = [];
      for (let i = 0n; i < p.milestoneCount; i++) {
        ms.push(await getMilestone(projectId, i));
      }
      setMilestones(ms);
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, getProject, getMilestone]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleAction = async (label: string, fn: () => Promise<void>) => {
    setActionLoading(label);
    try {
      await fn();
      await load();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Transaction failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !project) {
    return <div className="panel detail-panel"><div className="empty-state">Loading...</div></div>;
  }

  const isStudio = role === "studio";
  const isDev = role === "developer";
  const isAssignedDev = project.developer.toLowerCase() === account.toLowerCase();
  const isActive = project.status === ProjectStatus.Active;
  const isCompleted = project.status === ProjectStatus.Completed;
  const isDisputed = project.status === ProjectStatus.Disputed;
  const hasNoDev = project.developer === ethers.ZeroAddress;

  return (
    <div className="panel detail-panel">
      <div className="panel-header">
        <h2>{project.title}</h2>
        <span className={`status-badge status-${["active", "completed", "disputed", "cancelled"][project.status]}`}>
          {["Active", "Completed", "Disputed", "Cancelled"][project.status]}
        </span>
      </div>
      <div className="panel-body">
        <p className="project-description">{project.description}</p>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Budget</label>
            <span>{ethers.formatEther(project.budget)} ETH</span>
          </div>
          <div className="detail-item">
            <label>Deadline</label>
            <span>{new Date(Number(project.deadline) * 1000).toLocaleDateString()}</span>
          </div>
          <div className="detail-item">
            <label>Developer</label>
            <span>{hasNoDev ? "Unassigned" : project.developer.slice(0, 6) + "..." + project.developer.slice(-4)}</span>
          </div>
          <div className="detail-item">
            <label>Milestones</label>
            <span>{Number(project.approvedCount)} / {Number(project.milestoneCount)} approved</span>
          </div>
        </div>

        {/* Studio: Assign developer */}
        {isStudio && isActive && hasNoDev && (
          <div className="action-section">
            <h3>Assign Developer</h3>
            <div className="inline-form">
              <input
                type="text"
                placeholder="Developer address (0x...)"
                value={devAddress}
                onChange={(e) => setDevAddress(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={!!actionLoading || !devAddress}
                onClick={() => handleAction("assign", () => assignDeveloper(projectId, devAddress))}
              >
                {actionLoading === "assign" ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        )}

        {/* Studio: Add milestone */}
        {isStudio && isActive && (
          <div className="action-section">
            <div className="section-header">
              <h3>Milestones</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddMilestone(!showAddMilestone)}>
                {showAddMilestone ? "Cancel" : "+ Add Milestone"}
              </button>
            </div>
            {showAddMilestone && (
              <div className="add-milestone-form">
                <input type="text" placeholder="Milestone title" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
                <input type="text" placeholder="Value in ETH" value={msValue} onChange={(e) => setMsValue(e.target.value)} />
                <input type="number" placeholder="Days until deadline" value={msDays} onChange={(e) => setMsDays(e.target.value)} />
                <button
                  className="btn btn-primary"
                  disabled={!!actionLoading || !msTitle || !msValue}
                  onClick={() => handleAction("addMs", async () => {
                    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(msDays) * 86400);
                    await addMilestone(projectId, msTitle, ethers.parseEther(msValue), deadline);
                    setMsTitle("");
                    setMsValue("");
                    setShowAddMilestone(false);
                  })}
                >
                  {actionLoading === "addMs" ? "Adding..." : "Add"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Milestone list */}
        <div className="milestones-section">
          {!isStudio && <h3>Milestones</h3>}
          {milestones.length === 0 ? (
            <div className="empty-state">No milestones yet</div>
          ) : (
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
                    {/* Developer: Submit */}
                    {isDev && isAssignedDev && ms.status === MilestoneStatus.Pending && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!!actionLoading}
                        onClick={() => handleAction(`submit-${i}`, () => submitMilestone(projectId, BigInt(i)))}
                      >
                        {actionLoading === `submit-${i}` ? "Submitting..." : "Submit"}
                      </button>
                    )}
                    {/* Studio: Approve */}
                    {isStudio && ms.status === MilestoneStatus.Submitted && (
                      <button
                        className="btn btn-success btn-sm"
                        disabled={!!actionLoading}
                        onClick={() => handleAction(`approve-${i}`, () => approveMilestone(projectId, BigInt(i)))}
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
          )}
        </div>

        {/* Dispute actions */}
        {isActive && (isStudio || (isDev && isAssignedDev)) && (
          <div className="action-section dispute-section">
            <button
              className="btn btn-danger btn-sm"
              disabled={!!actionLoading}
              onClick={() => handleAction("dispute", () => raiseDispute(projectId))}
            >
              {actionLoading === "dispute" ? "Raising..." : "Raise Dispute"}
            </button>
          </div>
        )}

        {/* Resolve dispute (studio only) */}
        {isStudio && isDisputed && (
          <div className="action-section">
            <h3>Resolve Dispute</h3>
            <div className="dispute-resolve-btns">
              <button
                className="btn btn-success"
                disabled={!!actionLoading}
                onClick={() => handleAction("resolve", () => resolveDispute(projectId, true))}
              >
                {actionLoading === "resolve" ? "..." : "Favor Developer"}
              </button>
              <button
                className="btn btn-danger"
                disabled={!!actionLoading}
                onClick={() => handleAction("resolve2", () => resolveDispute(projectId, false))}
              >
                {actionLoading === "resolve2" ? "..." : "Favor Studio (Refund)"}
              </button>
            </div>
          </div>
        )}

        {/* Rate developer (studio, completed project) */}
        {isStudio && isCompleted && !hasNoDev && (
          <div className="action-section">
            <h3>Rate Developer</h3>
            <div className="rating-section">
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`star-btn ${star <= ratingValue ? "filled" : ""}`}
                    onClick={() => setRatingValue(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={!!actionLoading}
                onClick={() => handleAction("rate", () => rateDeveloper(projectId, ratingValue))}
              >
                {actionLoading === "rate" ? "Rating..." : "Submit Rating"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

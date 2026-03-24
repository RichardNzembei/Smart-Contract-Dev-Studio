import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useProjects } from "../../hooks/useProjects";
import { ProjectCard } from "../shared/ProjectCard";
import { MilestoneList } from "../shared/MilestoneList";
import { ActivityFeed } from "../ActivityFeed";
import type { Project, Milestone, ProjectPayments, ActivityEvent } from "../../config/types";
import { ProjectStatus } from "../../config/types";

interface Props {
  account: string;
  balance: string;
  refreshKey: number;
  activity: ActivityEvent[];
  onRefresh: () => void;
  getProjectCount: () => Promise<bigint>;
  getProject: (id: bigint) => Promise<Project>;
  getProjectPayments: (id: bigint) => Promise<ProjectPayments>;
  getMilestone: (projectId: bigint, index: bigint) => Promise<Milestone>;
  raiseDispute: (projectId: bigint) => Promise<void>;
  resolveDispute: (projectId: bigint, inFavorOfDev: boolean) => Promise<void>;
  expireProject: (projectId: bigint) => Promise<void>;
  getDisputeRaiser: (projectId: bigint) => Promise<string>;
  getStudioRating: () => Promise<{ average: bigint; count: bigint }>;
  getActiveMilestoneCount: (projectId: bigint) => Promise<bigint>;
}

export function StudioDashboard(props: Props) {
  const { projects, loading, stats } = useProjects({
    filter: "all",
    account: props.account,
    refreshKey: props.refreshKey,
    getProjectCount: props.getProjectCount,
    getProject: props.getProject,
    getProjectPayments: props.getProjectPayments,
  });

  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [disputeRaiser, setDisputeRaiser] = useState<string>(ethers.ZeroAddress);
  const [activeMsCount, setActiveMsCount] = useState<bigint>(0n);
  const [studioRating, setStudioRating] = useState<{ average: bigint; count: bigint }>({ average: 0n, count: 0n });
  const [isExpired, setIsExpired] = useState(false);

  const showToast = (msg: string, type: string) => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDetail = useCallback(async () => {
    if (selectedId === null) return;
    try {
      const p = await props.getProject(selectedId);
      setProject(p);
      const ms: Milestone[] = [];
      for (let i = 0n; i < p.milestoneCount; i++) {
        ms.push(await props.getMilestone(selectedId, i));
      }
      setMilestones(ms);

      if (p.status === ProjectStatus.Disputed) {
        const raiser = await props.getDisputeRaiser(selectedId);
        setDisputeRaiser(raiser);
      }
      const activeCount = await props.getActiveMilestoneCount(selectedId);
      setActiveMsCount(activeCount);
      setIsExpired(Date.now() / 1000 > Number(p.deadline));
    } catch (err) {
      console.error(err);
    }
  }, [selectedId, props]);

  useEffect(() => { loadDetail(); }, [loadDetail, props.refreshKey]);

  useEffect(() => {
    props.getStudioRating().then(setStudioRating).catch(() => {});
  }, [props.refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (label: string, fn: () => Promise<void>) => {
    setActionLoading(label);
    try {
      await fn();
      showToast("Transaction confirmed", "success");
      await loadDetail();
      props.onRefresh();
    } catch (err: any) {
      showToast(err.message || "Transaction failed", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredProjects = statusFilter !== null ? projects.filter(p => p.status === statusFilter) : projects;
  const isActive = project?.status === ProjectStatus.Active;
  const isDisputed = project?.status === ProjectStatus.Disputed;
  const studioIsDisputeRaiser = disputeRaiser.toLowerCase() === props.account.toLowerCase();

  return (
    <div className="dashboard studio-dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Summary Strip */}
      <div className="dashboard-summary">
        <div className="stat-card">
          <label>All Projects</label>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <label>Active</label>
          <span className="stat-value" style={{ color: "var(--blue)" }}>{stats.activeCount}</span>
        </div>
        <div className="stat-card">
          <label>Disputed</label>
          <span className="stat-value" style={{ color: "var(--yellow)" }}>{stats.disputedCount}</span>
        </div>
        <div className="stat-card">
          <label>Completed</label>
          <span className="stat-value" style={{ color: "var(--green)" }}>{stats.completedCount}</span>
        </div>
        <div className="stat-card">
          <label>Platform Rating</label>
          <span className="stat-value">
            {studioRating.count > 0n ? `${"★".repeat(Number(studioRating.average))}${"☆".repeat(5 - Number(studioRating.average))} (${studioRating.count})` : "No ratings"}
          </span>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Left: All Projects (read-only overview) */}
        <div className="dashboard-left">
          <div className="panel">
            <div className="panel-header">
              <h2>Platform Overview</h2>
            </div>
            <div className="filter-bar">
              <button className={`filter-btn ${statusFilter === null ? "active" : ""}`} onClick={() => setStatusFilter(null)}>All</button>
              <button className={`filter-btn ${statusFilter === 0 ? "active" : ""}`} onClick={() => setStatusFilter(0)}>Active</button>
              <button className={`filter-btn ${statusFilter === 2 ? "active" : ""}`} onClick={() => setStatusFilter(2)}>Disputed</button>
              <button className={`filter-btn ${statusFilter === 1 ? "active" : ""}`} onClick={() => setStatusFilter(1)}>Completed</button>
              <button className={`filter-btn ${statusFilter === 3 ? "active" : ""}`} onClick={() => setStatusFilter(3)}>Cancelled</button>
            </div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? (
                <>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}</>
              ) : filteredProjects.length === 0 ? (
                <div className="empty-state">No projects on the platform yet.</div>
              ) : (
                filteredProjects.map((p) => (
                  <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail + Arbitration */}
        <div className="dashboard-right">
          {selectedId !== null && project ? (
            <div className="panel detail-panel">
              <div className="panel-header">
                <h2>{project.title}</h2>
                <span className={`status-badge status-${["active","completed","disputed","cancelled"][project.status]}`}>
                  {["Active","Completed","Disputed","Cancelled"][project.status]}
                  {isActive && isExpired && " (Overdue)"}
                </span>
              </div>
              <div className="panel-body">
                <p className="project-description">{project.description}</p>
                <div className="detail-grid">
                  <div className="detail-item"><label>Budget</label><span>{ethers.formatEther(project.budget)} ETH</span></div>
                  <div className="detail-item"><label>Deadline</label><span>{new Date(Number(project.deadline) * 1000).toLocaleDateString()}</span></div>
                  <div className="detail-item"><label>Client</label><span>{project.client === ethers.ZeroAddress ? "None" : project.client.slice(0,6)+"..."+project.client.slice(-4)}</span></div>
                  <div className="detail-item"><label>Developer</label><span>{project.developer === ethers.ZeroAddress ? "Unassigned" : project.developer.slice(0,6)+"..."+project.developer.slice(-4)}</span></div>
                  <div className="detail-item"><label>Milestones</label><span>{Number(project.approvedCount)}/{Number(activeMsCount)} approved</span></div>
                </div>

                {/* Read-only milestone list */}
                <div className="milestones-section">
                  <h3>Milestones</h3>
                  <MilestoneList milestones={milestones} project={project} role="studio" account={props.account} actionLoading={null} />
                </div>

                {/* Arbitration: Raise Dispute */}
                {isActive && (
                  <div className="action-section dispute-section">
                    {isExpired && (
                      <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => {
                        if (!window.confirm("Expire this overdue project? Remaining budget will be refunded proportionally to funders.")) return;
                        handleAction("expire", () => props.expireProject(selectedId));
                      }} style={{ marginRight: 8 }}>
                        {actionLoading === "expire" ? "..." : "Expire Project"}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" disabled={!!actionLoading} onClick={() => {
                      if (!window.confirm("Raise a dispute as platform arbitrator? This will freeze all milestone activity.")) return;
                      handleAction("dispute", () => props.raiseDispute(selectedId));
                    }}>
                      {actionLoading === "dispute" ? "..." : "Raise Dispute"}
                    </button>
                  </div>
                )}

                {/* Arbitration: Resolve Dispute */}
                {isDisputed && (
                  <div className="action-section">
                    <h3>Resolve Dispute (Arbitrator)</h3>
                    {studioIsDisputeRaiser && (
                      <p style={{ fontSize: "12px", color: "var(--yellow)", marginBottom: 8 }}>
                        You raised this dispute. You cannot resolve it in your own favor.
                      </p>
                    )}
                    <div className="dispute-resolve-btns">
                      <button className="btn btn-success" disabled={!!actionLoading} onClick={() => {
                        if (!window.confirm("Resolve in favor of developer? Submitted milestones will be approved and paid.")) return;
                        handleAction("resolve", () => props.resolveDispute(selectedId, true));
                      }}>Favor Developer</button>
                      <button className="btn btn-danger" disabled={!!actionLoading || studioIsDisputeRaiser} onClick={() => {
                        if (!window.confirm("Resolve against developer? Remaining funds will be refunded to funders.")) return;
                        handleAction("resolve2", () => props.resolveDispute(selectedId, false));
                      }}>Favor Client (Refund)</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header"><h2>Platform Arbitrator</h2></div>
              <div className="panel-body">
                <p className="info-hint">Select a project to view details. As platform arbitrator, you can resolve disputes and expire overdue projects.</p>
              </div>
            </div>
          )}
          <ActivityFeed events={props.activity} />
        </div>
      </div>
    </div>
  );
}

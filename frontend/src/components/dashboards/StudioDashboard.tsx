import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useProjects } from "../../hooks/useProjects";
import { ProjectCard } from "../shared/ProjectCard";
import { PaymentFlowCard } from "../shared/PaymentFlowCard";
import { MilestoneList } from "../shared/MilestoneList";
import { ActivityFeed } from "../ActivityFeed";
import { DeveloperPanel } from "../DeveloperPanel";
import type { Project, Milestone, Role, ProjectPayments, ActivityEvent } from "../../config/types";
import { ProjectStatus, MilestoneStatus } from "../../config/types";

interface DevDisplay {
  wallet: string;
  name: string;
  avgRating: number;
  ratingCount: number;
}

interface Props {
  account: string;
  balance: string;
  refreshKey: number;
  activity: ActivityEvent[];
  knownDevs: DevDisplay[];
  onNewProject: () => void;
  onRefresh: () => void;
  onRegisterDev: (name: string) => Promise<void>;
  getProjectCount: () => Promise<bigint>;
  getProject: (id: bigint) => Promise<Project>;
  getProjectPayments: (id: bigint) => Promise<ProjectPayments>;
  getMilestone: (projectId: bigint, index: bigint) => Promise<Milestone>;
  assignDeveloper: (projectId: bigint, devAddress: string) => Promise<void>;
  addMilestone: (projectId: bigint, title: string, value: bigint, deadline: bigint) => Promise<void>;
  approveMilestone: (projectId: bigint, index: bigint) => Promise<void>;
  raiseDispute: (projectId: bigint) => Promise<void>;
  resolveDispute: (projectId: bigint, inFavorOfDev: boolean) => Promise<void>;
  rateDeveloper: (projectId: bigint, rating: number) => Promise<void>;
  cancelProject: (projectId: bigint) => Promise<void>;
  withdrawUnclaimable: (projectId: bigint) => Promise<void>;
}

export function StudioDashboard(props: Props) {
  const { projects, paymentsMap, loading, stats } = useProjects({
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
  const [ratingValue, setRatingValue] = useState(5);
  const [devAddress, setDevAddress] = useState("");
  const [showAddMs, setShowAddMs] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msValue, setMsValue] = useState("");
  const [msDays, setMsDays] = useState("30");
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

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
    } catch (err) {
      console.error(err);
    }
  }, [selectedId, props]);

  useEffect(() => { loadDetail(); }, [loadDetail, props.refreshKey]);

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
  const payments = selectedId !== null ? paymentsMap[selectedId.toString()] : null;
  const isActive = project?.status === ProjectStatus.Active;
  const isCompleted = project?.status === ProjectStatus.Completed;
  const isDisputed = project?.status === ProjectStatus.Disputed;
  const hasNoDev = project?.developer === ethers.ZeroAddress;

  return (
    <div className="dashboard studio-dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Summary Strip */}
      <div className="dashboard-summary">
        <div className="stat-card">
          <label>Projects</label>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <label>Active</label>
          <span className="stat-value" style={{ color: "var(--blue)" }}>{stats.activeCount}</span>
        </div>
        <div className="stat-card">
          <label>Completed</label>
          <span className="stat-value" style={{ color: "var(--green)" }}>{stats.completedCount}</span>
        </div>
        <div className="stat-card">
          <label>Disputed</label>
          <span className="stat-value" style={{ color: "var(--yellow)" }}>{stats.disputedCount}</span>
        </div>
        <div className="stat-card">
          <label>Total Locked</label>
          <span className="stat-value">{parseFloat(ethers.formatEther(stats.totalBudget)).toFixed(2)} ETH</span>
        </div>
        <div className="stat-card">
          <label>Paid to Devs</label>
          <span className="stat-value" style={{ color: "var(--green)" }}>{parseFloat(ethers.formatEther(stats.totalPaidToDev)).toFixed(2)} ETH</span>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Left: Project List */}
        <div className="dashboard-left">
          <div className="panel">
            <div className="panel-header">
              <h2>All Projects</h2>
              <button className="btn btn-primary btn-sm" onClick={props.onNewProject}>+ New Project</button>
            </div>
            <div className="filter-bar">
              <button className={`filter-btn ${statusFilter === null ? "active" : ""}`} onClick={() => setStatusFilter(null)}>All</button>
              <button className={`filter-btn ${statusFilter === 0 ? "active" : ""}`} onClick={() => setStatusFilter(0)}>Active</button>
              <button className={`filter-btn ${statusFilter === 1 ? "active" : ""}`} onClick={() => setStatusFilter(1)}>Completed</button>
              <button className={`filter-btn ${statusFilter === 2 ? "active" : ""}`} onClick={() => setStatusFilter(2)}>Disputed</button>
              <button className={`filter-btn ${statusFilter === 3 ? "active" : ""}`} onClick={() => setStatusFilter(3)}>Cancelled</button>
            </div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? (
                <>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}</>
              ) : filteredProjects.length === 0 ? (
                <div className="empty-state">No projects yet. Create one!</div>
              ) : (
                filteredProjects.map((p) => (
                  <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />
                ))
              )}
            </div>
          </div>
          <DeveloperPanel role="studio" connected={true} registerDeveloper={props.onRegisterDev} knownDevs={props.knownDevs} />
        </div>

        {/* Right: Detail + Activity */}
        <div className="dashboard-right">
          {selectedId !== null && project ? (
            <div className="panel detail-panel">
              <div className="panel-header">
                <h2>{project.title}</h2>
                <span className={`status-badge status-${["active","completed","disputed","cancelled"][project.status]}`}>
                  {["Active","Completed","Disputed","Cancelled"][project.status]}
                </span>
              </div>
              <div className="panel-body">
                <p className="project-description">{project.description}</p>
                <div className="detail-grid">
                  <div className="detail-item"><label>Budget</label><span>{ethers.formatEther(project.budget)} ETH</span></div>
                  <div className="detail-item"><label>Deadline</label><span>{new Date(Number(project.deadline) * 1000).toLocaleDateString()}</span></div>
                  <div className="detail-item"><label>Developer</label><span>{hasNoDev ? "Unassigned" : (() => { const d = props.knownDevs.find(d => d.wallet.toLowerCase() === project.developer.toLowerCase()); return d ? `${d.name} (${project.developer.slice(0,6)}...)` : project.developer.slice(0,6)+"..."+project.developer.slice(-4); })()}</span></div>
                  <div className="detail-item"><label>Client</label><span>{project.client === ethers.ZeroAddress ? "No client" : project.client.slice(0,6)+"..."+project.client.slice(-4)}</span></div>
                  <div className="detail-item"><label>Milestones</label><span>{Number(project.approvedCount)}/{Number(project.milestoneCount)} approved</span></div>
                </div>

                {payments && <PaymentFlowCard payments={payments} perspective="studio" />}

                {/* Assign Dev */}
                {isActive && hasNoDev && (
                  <div className="action-section">
                    <h3>Assign Developer</h3>
                    <div className="inline-form">
                      {props.knownDevs.length > 0 ? (
                        <select value={devAddress} onChange={e => setDevAddress(e.target.value)} style={{ flex: 1 }}>
                          <option value="">Select a developer...</option>
                          {props.knownDevs.map(d => (
                            <option key={d.wallet} value={d.wallet}>{d.name} ({d.wallet.slice(0,6)}...{d.wallet.slice(-4)}) — {d.avgRating}/5</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" placeholder="Developer address (0x...)" value={devAddress} onChange={e => setDevAddress(e.target.value)} />
                      )}
                      <button className="btn btn-primary" disabled={!!actionLoading || !devAddress} onClick={() => handleAction("assign", () => props.assignDeveloper(selectedId, devAddress))}>
                        {actionLoading === "assign" ? "..." : "Assign"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Milestone */}
                {isActive && (
                  <div className="action-section">
                    <div className="section-header">
                      <h3>Milestones</h3>
                      <button className="btn btn-sm btn-outline" onClick={() => setShowAddMs(!showAddMs)}>
                        {showAddMs ? "Cancel" : "+ Add Milestone"}
                      </button>
                    </div>
                    {showAddMs && (
                      <div className="add-milestone-form">
                        <input type="text" placeholder="Title" value={msTitle} onChange={e => setMsTitle(e.target.value)} />
                        <input type="text" placeholder="Value (ETH)" value={msValue} onChange={e => setMsValue(e.target.value)} />
                        <input type="number" placeholder="Days" value={msDays} onChange={e => setMsDays(e.target.value)} min="1" style={{ maxWidth: 80 }} title="Days until deadline" />
                        <button className="btn btn-primary" disabled={!!actionLoading || !msTitle || !msValue || !msDays}
                          onClick={() => handleAction("addMs", async () => {
                            const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(msDays) * 86400);
                            await props.addMilestone(selectedId, msTitle, ethers.parseEther(msValue), deadline);
                            setMsTitle(""); setMsValue(""); setMsDays("30"); setShowAddMs(false);
                          })}>Add</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="milestones-section">
                  <MilestoneList milestones={milestones} project={project} role="studio" account={props.account} actionLoading={actionLoading}
                    onApprove={(i) => handleAction(`approve-${i}`, () => props.approveMilestone(selectedId, BigInt(i)))} />
                </div>

                {/* Dispute / Cancel */}
                {isActive && (
                  <div className="action-section dispute-section">
                    {project.approvedCount === 0n && (
                      <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => {
                        if (!window.confirm("Cancel this project? The entire budget will be refunded to the studio. This cannot be undone.")) return;
                        handleAction("cancel", () => props.cancelProject(selectedId));
                      }} style={{ marginRight: 8 }}>
                        {actionLoading === "cancel" ? "..." : "Cancel Project"}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" disabled={!!actionLoading} onClick={() => {
                      if (!window.confirm("Raise a dispute on this project? This will freeze all milestone activity until resolved.")) return;
                      handleAction("dispute", () => props.raiseDispute(selectedId));
                    }}>
                      {actionLoading === "dispute" ? "..." : "Raise Dispute"}
                    </button>
                  </div>
                )}

                {/* Resolve Dispute */}
                {isDisputed && (
                  <div className="action-section">
                    <h3>Resolve Dispute</h3>
                    <div className="dispute-resolve-btns">
                      <button className="btn btn-success" disabled={!!actionLoading} onClick={() => {
                        if (!window.confirm("Resolve in favor of developer? Submitted milestones will be approved and paid.")) return;
                        handleAction("resolve", () => props.resolveDispute(selectedId, true));
                      }}>Favor Developer</button>
                      <button className="btn btn-danger" disabled={!!actionLoading} onClick={() => {
                        if (!window.confirm("Resolve in favor of studio? Remaining funds will be refunded to the studio.")) return;
                        handleAction("resolve2", () => props.resolveDispute(selectedId, false));
                      }}>Favor Studio (Refund)</button>
                    </div>
                  </div>
                )}

                {/* Withdraw */}
                {(isCompleted || project.status === ProjectStatus.Cancelled) && project.approvedCount < project.milestoneCount && (
                  <div className="action-section">
                    <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => handleAction("withdraw", () => props.withdrawUnclaimable(selectedId))}>
                      {actionLoading === "withdraw" ? "..." : "Withdraw Locked Funds"}
                    </button>
                  </div>
                )}

                {/* Rate */}
                {isCompleted && !hasNoDev && (
                  <div className="action-section">
                    <h3>Rate Developer</h3>
                    <div className="rating-section">
                      <div className="star-rating">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} className={`star-btn ${s <= ratingValue ? "filled" : ""}`} onClick={() => setRatingValue(s)}>★</button>
                        ))}
                      </div>
                      <button className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handleAction("rate", () => props.rateDeveloper(selectedId, ratingValue))}>
                        {actionLoading === "rate" ? "..." : "Submit Rating"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header"><h2>Studio Dashboard</h2></div>
              <div className="panel-body">
                <p className="info-hint">Select a project to manage it, or create a new one.</p>
              </div>
            </div>
          )}
          <ActivityFeed events={props.activity} />
        </div>
      </div>
    </div>
  );
}

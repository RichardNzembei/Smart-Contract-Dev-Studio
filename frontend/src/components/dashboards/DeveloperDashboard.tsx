import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useProjects } from "../../hooks/useProjects";
import { ProjectCard } from "../shared/ProjectCard";
import { PaymentFlowCard } from "../shared/PaymentFlowCard";
import { MilestoneList } from "../shared/MilestoneList";
import { ActivityFeed } from "../ActivityFeed";
import type { Project, Milestone, Developer, ProjectPayments, ActivityEvent } from "../../config/types";
import { ProjectStatus } from "../../config/types";

interface Props {
  account: string;
  balance: string;
  refreshKey: number;
  activity: ActivityEvent[];
  getProjectCount: () => Promise<bigint>;
  getProject: (id: bigint) => Promise<Project>;
  getProjectPayments: (id: bigint) => Promise<ProjectPayments>;
  getMilestone: (projectId: bigint, index: bigint) => Promise<Milestone>;
  getDeveloper: (wallet: string) => Promise<Developer>;
  getDeveloperRating: (wallet: string) => Promise<{ average: bigint; count: bigint }>;
  registerDeveloper: (name: string) => Promise<void>;
  submitMilestone: (projectId: bigint, index: bigint) => Promise<void>;
  raiseDispute: (projectId: bigint) => Promise<void>;
  withdrawFunds: () => Promise<void>;
  getPendingWithdrawal: (address: string) => Promise<bigint>;
  rateStudio: (projectId: bigint, rating: number) => Promise<void>;
  isProjectStudioRated: (projectId: bigint) => Promise<boolean>;
  acceptAssignment: (projectId: bigint) => Promise<void>;
  rejectAssignment: (projectId: bigint) => Promise<void>;
  getProposedDeveloper: (projectId: bigint) => Promise<string>;
  getActiveMilestoneCount: (projectId: bigint) => Promise<bigint>;
  onRefresh: () => void;
}

export function DeveloperDashboard(props: Props) {
  const { myProjects, availableProjects, paymentsMap, loading } = useProjects({
    filter: "assigned",
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
  const [devInfo, setDevInfo] = useState<{ name: string; registered: boolean; avgRating: number; ratingCount: number } | null>(null);
  const [regName, setRegName] = useState("");
  const [pendingBalance, setPendingBalance] = useState(0n);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [studioRatingValue, setStudioRatingValue] = useState(5);
  const [studioAlreadyRated, setStudioAlreadyRated] = useState(false);
  const [proposedProjects, setProposedProjects] = useState<bigint[]>([]);
  const [activeMsCount, setActiveMsCount] = useState<bigint>(0n);

  const showToast = (msg: string, type: string) => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load dev profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const dev = await props.getDeveloper(props.account);
        if (dev.registered) {
          const rating = await props.getDeveloperRating(props.account);
          setDevInfo({ name: dev.name, registered: true, avgRating: Number(rating.average), ratingCount: Number(rating.count) });
        } else {
          setDevInfo({ name: "", registered: false, avgRating: 0, ratingCount: 0 });
        }
      } catch {
        setDevInfo({ name: "", registered: false, avgRating: 0, ratingCount: 0 });
      }
    }
    loadProfile();
  }, [props.account, props.refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load pending withdrawal balance
  useEffect(() => {
    props.getPendingWithdrawal(props.account).then(setPendingBalance).catch(() => {});
  }, [props.account, props.refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for pending proposals on available projects
  useEffect(() => {
    async function checkProposals() {
      const proposed: bigint[] = [];
      for (const p of availableProjects) {
        try {
          const proposedDev = await props.getProposedDeveloper(p.id);
          if (proposedDev.toLowerCase() === props.account.toLowerCase()) {
            proposed.push(p.id);
          }
        } catch { /* skip */ }
      }
      setProposedProjects(proposed);
    }
    if (devInfo?.registered && availableProjects.length > 0) {
      checkProposals();
    }
  }, [availableProjects, devInfo, props.account, props.refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const activeCount = await props.getActiveMilestoneCount(selectedId);
      setActiveMsCount(activeCount);

      // Check if studio already rated for this project
      if (p.status === ProjectStatus.Completed && p.developer.toLowerCase() === props.account.toLowerCase()) {
        const rated = await props.isProjectStudioRated(selectedId);
        setStudioAlreadyRated(rated);
      }
    } catch (err) { console.error(err); }
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

  const handleRegister = async () => {
    if (!regName.trim()) return;
    setActionLoading("register");
    try {
      await props.registerDeveloper(regName);
      showToast("Registered successfully!", "success");
      setRegName("");
      props.onRefresh();
    } catch (err: any) {
      showToast(err.message || "Registration failed", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Compute total earnings
  const totalEarned = myProjects.reduce((sum, p) => {
    const pay = paymentsMap[p.id.toString()];
    return sum + (pay?.paidToDev ?? 0n);
  }, 0n);

  const payments = selectedId !== null ? paymentsMap[selectedId.toString()] : null;
  const isActive = project?.status === ProjectStatus.Active;
  const isCompleted = project?.status === ProjectStatus.Completed;
  const isMyProject = project?.developer.toLowerCase() === props.account.toLowerCase();

  return (
    <div className="dashboard developer-dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Profile Card */}
      <div className="dashboard-summary dev-profile">
        {devInfo?.registered ? (
          <>
            <div className="stat-card" style={{ flex: 2 }}>
              <label>Developer</label>
              <span className="stat-value" style={{ fontSize: "18px" }}>{devInfo.name}</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{props.account.slice(0, 10)}...{props.account.slice(-6)}</span>
            </div>
            <div className="stat-card">
              <label>Rating</label>
              <span className="stat-value">
                {"★".repeat(devInfo.avgRating)}{"☆".repeat(5 - devInfo.avgRating)}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{devInfo.ratingCount} ratings</span>
            </div>
            <div className="stat-card">
              <label>Total Earned</label>
              <span className="stat-value" style={{ color: "var(--green)" }}>{parseFloat(ethers.formatEther(totalEarned)).toFixed(4)} ETH</span>
            </div>
            <div className="stat-card">
              <label>Active Projects</label>
              <span className="stat-value">{myProjects.filter(p => p.status === ProjectStatus.Active).length}</span>
            </div>
            <div className="stat-card">
              <label>Balance</label>
              <span className="stat-value">{props.balance} ETH</span>
              {pendingBalance > 0n && (
                <button className="btn btn-success btn-sm" style={{ marginTop: 6, fontSize: "11px" }}
                  disabled={!!actionLoading}
                  onClick={() => handleAction("withdraw", () => props.withdrawFunds())}>
                  {actionLoading === "withdraw" ? "..." : `Withdraw ${parseFloat(ethers.formatEther(pendingBalance)).toFixed(4)} ETH`}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="stat-card" style={{ flex: 1, textAlign: "center" }}>
            <h3 style={{ marginBottom: "10px" }}>Register as a Developer</h3>
            <div className="inline-form" style={{ justifyContent: "center" }}>
              <input type="text" placeholder="Your name" value={regName} onChange={e => setRegName(e.target.value)} style={{ maxWidth: "250px" }} />
              <button className="btn btn-primary" disabled={!!actionLoading || !regName.trim()} onClick={handleRegister}>
                {actionLoading === "register" ? "..." : "Register"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-content">
        <div className="dashboard-left">
          {/* Pending Proposals */}
          {proposedProjects.length > 0 && (
            <div className="panel">
              <div className="panel-header"><h2>Pending Proposals</h2></div>
              <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {proposedProjects.map(pId => {
                  const proj = availableProjects.find(p => p.id === pId);
                  return proj ? (
                    <div key={Number(pId)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", background: "var(--surface-2)", borderRadius: 6 }}>
                      <div style={{ flex: 1 }}>
                        <strong>{proj.title}</strong>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{ethers.formatEther(proj.budget)} ETH</div>
                      </div>
                      <button className="btn btn-success btn-sm" disabled={!!actionLoading}
                        onClick={() => handleAction(`accept-${pId}`, () => props.acceptAssignment(pId))}>
                        {actionLoading === `accept-${pId}` ? "..." : "Accept"}
                      </button>
                      <button className="btn btn-outline btn-sm" disabled={!!actionLoading}
                        onClick={() => handleAction(`reject-${pId}`, () => props.rejectAssignment(pId))}>
                        {actionLoading === `reject-${pId}` ? "..." : "Reject"}
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* My Projects */}
          <div className="panel">
            <div className="panel-header"><h2>My Projects</h2></div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? <>{[1,2].map(i => <div key={i} className="skeleton skeleton-card" />)}</> :
                myProjects.length === 0 ? <div className="empty-state">No projects assigned to you yet</div> :
                myProjects.map(p => <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />)
              }
            </div>
          </div>
          {/* Available */}
          <div className="panel">
            <div className="panel-header"><h2>Available Projects</h2></div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {availableProjects.length === 0 ? <div className="empty-state">No open projects</div> :
                availableProjects.map(p => <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />)
              }
            </div>
          </div>
        </div>

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
                  <div className="detail-item"><label>Milestones</label><span>{Number(project.approvedCount)}/{Number(activeMsCount)} approved</span></div>
                </div>

                {payments && <PaymentFlowCard payments={payments} perspective="developer" />}

                <div className="milestones-section">
                  <h3>Milestones</h3>
                  <MilestoneList milestones={milestones} project={project} role="developer" account={props.account} actionLoading={actionLoading}
                    onSubmit={(i) => handleAction(`submit-${i}`, () => props.submitMilestone(selectedId, BigInt(i)))} />
                </div>

                {isActive && isMyProject && (
                  <div className="action-section dispute-section">
                    <button className="btn btn-danger btn-sm" disabled={!!actionLoading} onClick={() => {
                      if (!window.confirm("Raise a dispute on this project? This will freeze all milestone activity until the studio resolves it.")) return;
                      handleAction("dispute", () => props.raiseDispute(selectedId));
                    }}>
                      {actionLoading === "dispute" ? "..." : "Raise Dispute"}
                    </button>
                  </div>
                )}

                {/* Rate Studio — only on completed projects where dev is assigned */}
                {isCompleted && isMyProject && !studioAlreadyRated && (
                  <div className="action-section">
                    <h3>Rate Studio</h3>
                    <div className="rating-section">
                      <div className="star-rating">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} className={`star-btn ${s <= studioRatingValue ? "filled" : ""}`} onClick={() => setStudioRatingValue(s)}>★</button>
                        ))}
                      </div>
                      <button className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handleAction("rateStudio", () => props.rateStudio(selectedId, studioRatingValue))}>
                        {actionLoading === "rateStudio" ? "..." : "Submit Rating"}
                      </button>
                    </div>
                  </div>
                )}
                {isCompleted && isMyProject && studioAlreadyRated && (
                  <div className="action-section">
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Studio already rated for this project.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header"><h2>Developer Dashboard</h2></div>
              <div className="panel-body">
                <p className="info-hint">{devInfo?.registered ? "Select a project to view milestones and submit work." : "Register first, then you'll be able to work on projects."}</p>
              </div>
            </div>
          )}
          <ActivityFeed events={props.activity} />
        </div>
      </div>
    </div>
  );
}

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
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

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
          {/* My Projects */}
          <div className="panel">
            <div className="panel-header"><h2>My Projects</h2></div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? <div className="empty-state">Loading...</div> :
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
                  <div className="detail-item"><label>Milestones</label><span>{Number(project.approvedCount)}/{Number(project.milestoneCount)} approved</span></div>
                </div>

                {payments && <PaymentFlowCard payments={payments} perspective="developer" />}

                <div className="milestones-section">
                  <h3>Milestones</h3>
                  <MilestoneList milestones={milestones} project={project} role="developer" account={props.account} actionLoading={actionLoading}
                    onSubmit={(i) => handleAction(`submit-${i}`, () => props.submitMilestone(selectedId, BigInt(i)))} />
                </div>

                {isActive && project.developer.toLowerCase() === props.account.toLowerCase() && (
                  <div className="action-section dispute-section">
                    <button className="btn btn-danger btn-sm" disabled={!!actionLoading} onClick={() => handleAction("dispute", () => props.raiseDispute(selectedId))}>
                      {actionLoading === "dispute" ? "..." : "Raise Dispute"}
                    </button>
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

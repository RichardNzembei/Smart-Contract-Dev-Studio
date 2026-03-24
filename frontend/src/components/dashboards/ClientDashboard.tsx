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
  fundProject: (projectId: bigint, amountWei: bigint) => Promise<void>;
  raiseDispute: (projectId: bigint) => Promise<void>;
  getDeveloper: (wallet: string) => Promise<Developer>;
  getDeveloperRating: (wallet: string) => Promise<{ average: bigint; count: bigint }>;
  onRefresh: () => void;
}

export function ClientDashboard(props: Props) {
  const { fundedProjects, unfundedProjects, paymentsMap, loading, stats } = useProjects({
    filter: "funded",
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
  const [fundAmount, setFundAmount] = useState("");
  const [devDisplay, setDevDisplay] = useState<{ name: string; rating: number; count: number } | null>(null);
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
    } catch (err) { console.error(err); }
  }, [selectedId, props]);

  useEffect(() => { loadDetail(); }, [loadDetail, props.refreshKey]);

  // Resolve developer name + rating for the selected project
  useEffect(() => {
    if (!project || project.developer === ethers.ZeroAddress) { setDevDisplay(null); return; }
    (async () => {
      try {
        const dev = await props.getDeveloper(project.developer);
        const rating = await props.getDeveloperRating(project.developer);
        setDevDisplay({ name: dev.name, rating: Number(rating.average), count: Number(rating.count) });
      } catch { setDevDisplay(null); }
    })();
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const totalFunded = fundedProjects.reduce((sum, p) => {
    const pay = paymentsMap[p.id.toString()];
    return sum + (pay?.clientFunded ?? 0n);
  }, 0n);

  const payments = selectedId !== null ? paymentsMap[selectedId.toString()] : null;
  const isActive = project?.status === ProjectStatus.Active;

  return (
    <div className="dashboard client-dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Summary */}
      <div className="dashboard-summary">
        <div className="stat-card" style={{ flex: 2 }}>
          <label>Client Wallet</label>
          <span style={{ fontSize: "13px", fontFamily: "monospace", color: "var(--text-dim)" }}>{props.account.slice(0, 10)}...{props.account.slice(-6)}</span>
        </div>
        <div className="stat-card">
          <label>Balance</label>
          <span className="stat-value">{props.balance} ETH</span>
        </div>
        <div className="stat-card">
          <label>Total Funded</label>
          <span className="stat-value" style={{ color: "var(--blue)" }}>{parseFloat(ethers.formatEther(totalFunded)).toFixed(4)} ETH</span>
        </div>
        <div className="stat-card">
          <label>Funded Projects</label>
          <span className="stat-value">{fundedProjects.length}</span>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-left">
          {/* My Funded */}
          <div className="panel">
            <div className="panel-header"><h2>My Funded Projects</h2></div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? <>{[1,2].map(i => <div key={i} className="skeleton skeleton-card" />)}</> :
                fundedProjects.length === 0 ? <div className="empty-state">You haven't funded any projects yet</div> :
                fundedProjects.map(p => (
                  <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)}
                    showFundingBar={true} clientFunded={paymentsMap[p.id.toString()]?.clientFunded} />
                ))
              }
            </div>
          </div>
          {/* Available to Fund */}
          <div className="panel">
            <div className="panel-header"><h2>Available to Fund</h2></div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {unfundedProjects.length === 0 ? <div className="empty-state">No projects need funding</div> :
                unfundedProjects.map(p => <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />)
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
                  <div className="detail-item"><label>Total Budget</label><span>{ethers.formatEther(project.budget)} ETH</span></div>
                  <div className="detail-item"><label>Deadline</label><span>{new Date(Number(project.deadline) * 1000).toLocaleDateString()}</span></div>
                  <div className="detail-item"><label>Developer</label><span>{project.developer === ethers.ZeroAddress ? "Not assigned" : (
                    devDisplay ? (
                      <span>{devDisplay.name} {"★".repeat(devDisplay.rating)}{"☆".repeat(5 - devDisplay.rating)} <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>({devDisplay.count} ratings)</span></span>
                    ) : project.developer.slice(0,6)+"..."+project.developer.slice(-4)
                  )}</span></div>
                  <div className="detail-item"><label>Progress</label><span>{Number(project.approvedCount)}/{Number(project.milestoneCount)} milestones done</span></div>
                </div>

                {payments && <PaymentFlowCard payments={payments} perspective="client" />}

                {/* Fund */}
                {isActive && (
                  <div className="action-section">
                    <h3>Fund This Project</h3>
                    <div className="inline-form">
                      <input type="text" placeholder="Amount in ETH" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
                      <button className="btn btn-primary" disabled={!!actionLoading || !fundAmount}
                        onClick={() => handleAction("fund", async () => {
                          await props.fundProject(selectedId, ethers.parseEther(fundAmount));
                          setFundAmount("");
                        })}>
                        {actionLoading === "fund" ? "Funding..." : "Fund Project"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Milestones (read-only) */}
                <div className="milestones-section">
                  <h3>Milestone Progress</h3>
                  <MilestoneList milestones={milestones} project={project} role="client" account={props.account} actionLoading={null} />
                </div>

                {/* Dispute — H5: contract now allows client to raise disputes */}
                {isActive && project.client.toLowerCase() === props.account.toLowerCase() && (
                  <div className="action-section dispute-section">
                    <button className="btn btn-danger btn-sm" disabled={!!actionLoading} onClick={() => {
                      if (!window.confirm("Raise a dispute on this project? This will freeze all milestone activity until the studio resolves it.")) return;
                      handleAction("dispute", () => props.raiseDispute(selectedId));
                    }}>
                      {actionLoading === "dispute" ? "..." : "Raise Dispute"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header"><h2>Client Dashboard</h2></div>
              <div className="panel-body">
                <p className="info-hint">Select a project to view details and fund it. Your funds are locked in the smart contract and released to the developer as milestones are completed.</p>
              </div>
            </div>
          )}
          <ActivityFeed events={props.activity} />
        </div>
      </div>
    </div>
  );
}

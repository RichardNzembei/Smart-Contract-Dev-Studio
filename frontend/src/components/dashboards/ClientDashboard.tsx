import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useProjects } from "../../hooks/useProjects";
import { ProjectCard } from "../shared/ProjectCard";
import { PaymentFlowCard } from "../shared/PaymentFlowCard";
import { MilestoneList } from "../shared/MilestoneList";
import { ActivityFeed } from "../ActivityFeed";
import { DeveloperPanel } from "../DeveloperPanel";
import type { Project, Milestone, Developer, ProjectPayments, ActivityEvent } from "../../config/types";
import { ProjectStatus } from "../../config/types";

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
  getProjectCount: () => Promise<bigint>;
  getProject: (id: bigint) => Promise<Project>;
  getProjectPayments: (id: bigint) => Promise<ProjectPayments>;
  getMilestone: (projectId: bigint, index: bigint) => Promise<Milestone>;
  getDeveloper: (wallet: string) => Promise<Developer>;
  getDeveloperRating: (wallet: string) => Promise<{ average: bigint; count: bigint }>;
  // Project management
  addMilestone: (projectId: bigint, title: string, value: bigint, deadline: bigint) => Promise<void>;
  approveMilestone: (projectId: bigint, index: bigint) => Promise<void>;
  proposeDeveloper: (projectId: bigint, devAddress: string) => Promise<void>;
  assignDeveloper: (projectId: bigint, devAddress: string) => Promise<void>;
  rateDeveloper: (projectId: bigint, rating: number) => Promise<void>;
  cancelProject: (projectId: bigint) => Promise<void>;
  withdrawUnclaimable: (projectId: bigint) => Promise<void>;
  isProjectRated: (projectId: bigint) => Promise<boolean>;
  setFundingCap: (projectId: bigint, cap: bigint) => Promise<void>;
  topUpBudget: (projectId: bigint, amountWei: bigint) => Promise<void>;
  getProjectFundingCap: (projectId: bigint) => Promise<bigint>;
  getFunderContribution: (projectId: bigint, funder: string) => Promise<bigint>;
  getActiveMilestoneCount: (projectId: bigint) => Promise<bigint>;
  // Funding & disputes
  fundProject: (projectId: bigint, amountWei: bigint) => Promise<void>;
  raiseDispute: (projectId: bigint) => Promise<void>;
  withdrawFunds: () => Promise<void>;
  getPendingWithdrawal: (address: string) => Promise<bigint>;
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
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  // Project management state
  const [devAddress, setDevAddress] = useState("");
  const [showAddMs, setShowAddMs] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msValue, setMsValue] = useState("");
  const [msDays, setMsDays] = useState("30");
  const [ratingValue, setRatingValue] = useState(5);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");

  // Display state
  const [devDisplay, setDevDisplay] = useState<{ name: string; rating: number; count: number } | null>(null);
  const [pendingBalance, setPendingBalance] = useState(0n);
  const [fundingCap, setFundingCap] = useState<bigint>(0n);
  const [myContribution, setMyContribution] = useState<bigint>(0n);
  const [activeMsCount, setActiveMsCount] = useState<bigint>(0n);
  const [isExpired, setIsExpired] = useState(false);
  const [fundAmount, setFundAmount] = useState("");

  const showToast = (msg: string, type: string) => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    props.getPendingWithdrawal(props.account).then(setPendingBalance).catch(() => {});
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
      const cap = await props.getProjectFundingCap(selectedId);
      setFundingCap(cap);
      const contrib = await props.getFunderContribution(selectedId, props.account);
      setMyContribution(contrib);
      const activeCount = await props.getActiveMilestoneCount(selectedId);
      setActiveMsCount(activeCount);
      setIsExpired(Date.now() / 1000 > Number(p.deadline));

      if (p.status === ProjectStatus.Completed) {
        const rated = await props.isProjectRated(selectedId);
        setAlreadyRated(rated);
      }
    } catch (err) { console.error(err); }
  }, [selectedId, props]);

  useEffect(() => { loadDetail(); }, [loadDetail, props.refreshKey]);

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

  const payments = selectedId !== null ? paymentsMap[selectedId.toString()] : null;
  const isActive = project?.status === ProjectStatus.Active;
  const isCompleted = project?.status === ProjectStatus.Completed;
  const hasNoDev = project?.developer === ethers.ZeroAddress;
  const isMyProject = project?.client.toLowerCase() === props.account.toLowerCase();
  const totalClientFunded = payments?.clientFunded ?? 0n;
  const remainingCap = fundingCap > totalClientFunded ? fundingCap - totalClientFunded : 0n;

  return (
    <div className="dashboard client-dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Summary */}
      <div className="dashboard-summary">
        <div className="stat-card">
          <label>My Projects</label>
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
          <label>Total Budget</label>
          <span className="stat-value">{parseFloat(ethers.formatEther(stats.totalBudget)).toFixed(2)} ETH</span>
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
      </div>

      <div className="dashboard-content">
        <div className="dashboard-left">
          {/* My Projects */}
          <div className="panel">
            <div className="panel-header">
              <h2>My Projects</h2>
              <button className="btn btn-primary btn-sm" onClick={props.onNewProject}>+ New Project</button>
            </div>
            <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? <>{[1,2].map(i => <div key={i} className="skeleton skeleton-card" />)}</> :
                fundedProjects.length === 0 ? <div className="empty-state">No projects yet. Create one!</div> :
                fundedProjects.map(p => (
                  <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)}
                    showFundingBar={true} clientFunded={paymentsMap[p.id.toString()]?.clientFunded} />
                ))
              }
            </div>
          </div>
          {/* Available to Fund (other people's projects) */}
          {unfundedProjects.length > 0 && (
            <div className="panel">
              <div className="panel-header"><h2>Available to Fund</h2></div>
              <div className="panel-body" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {unfundedProjects.map(p => <ProjectCard key={Number(p.id)} project={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />)}
              </div>
            </div>
          )}
          <DeveloperPanel role="client" connected={true} registerDeveloper={async () => {}} knownDevs={props.knownDevs} />
        </div>

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
                  <div className="detail-item"><label>Total Budget</label><span>{ethers.formatEther(project.budget)} ETH</span></div>
                  <div className="detail-item"><label>Funding Cap</label><span>{ethers.formatEther(fundingCap)} ETH ({ethers.formatEther(remainingCap)} remaining)</span></div>
                  <div className="detail-item"><label>Your Contribution</label><span>{ethers.formatEther(myContribution)} ETH</span></div>
                  <div className="detail-item"><label>Deadline</label><span>{new Date(Number(project.deadline) * 1000).toLocaleDateString()}</span></div>
                  <div className="detail-item"><label>Developer</label><span>{hasNoDev ? "Not assigned" : (
                    devDisplay ? (
                      <span>{devDisplay.name} {"★".repeat(devDisplay.rating)}{"☆".repeat(5 - devDisplay.rating)} <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>({devDisplay.count} ratings)</span></span>
                    ) : project.developer.slice(0,6)+"..."+project.developer.slice(-4)
                  )}</span></div>
                  <div className="detail-item"><label>Progress</label><span>{Number(project.approvedCount)}/{Number(activeMsCount)} milestones done</span></div>
                </div>

                {payments && <PaymentFlowCard payments={payments} perspective="client" />}

                {/* === CLIENT PROJECT MANAGEMENT (only for project owner) === */}
                {isMyProject && (
                  <>
                    {/* Propose / Assign Developer */}
                    {isActive && hasNoDev && (
                      <div className="action-section">
                        <h3>Propose Developer</h3>
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
                          <button className="btn btn-primary" disabled={!!actionLoading || !devAddress} onClick={() => handleAction("propose", () => props.proposeDeveloper(selectedId, devAddress))}>
                            {actionLoading === "propose" ? "..." : "Propose"}
                          </button>
                          <button className="btn btn-outline btn-sm" disabled={!!actionLoading || !devAddress} onClick={() => handleAction("assign", () => props.assignDeveloper(selectedId, devAddress))} title="Direct assign (skip proposal)">
                            {actionLoading === "assign" ? "..." : "Direct Assign"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add Milestone — available whenever project is active */}
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

                    {/* Funding Cap */}
                    {isActive && (
                      <div className="action-section">
                        <h3>Funding Cap</h3>
                        <div className="inline-form">
                          <input type="text" placeholder="New cap (ETH)" value={capInput} onChange={e => setCapInput(e.target.value)} style={{ maxWidth: 120 }} />
                          <button className="btn btn-outline btn-sm" disabled={!!actionLoading || !capInput}
                            onClick={() => handleAction("setCap", async () => {
                              await props.setFundingCap(selectedId, ethers.parseEther(capInput));
                              setCapInput("");
                            })}>
                            {actionLoading === "setCap" ? "..." : "Set Cap"}
                          </button>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current: {ethers.formatEther(fundingCap)} ETH</span>
                        </div>
                      </div>
                    )}

                    {/* Top Up Budget */}
                    {isActive && (
                      <div className="action-section">
                        <h3>Top Up Budget</h3>
                        <div className="inline-form">
                          <input type="text" placeholder="Amount (ETH)" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} style={{ maxWidth: 120 }} />
                          <button className="btn btn-primary btn-sm" disabled={!!actionLoading || !topUpAmount}
                            onClick={() => handleAction("topUp", async () => {
                              await props.topUpBudget(selectedId, ethers.parseEther(topUpAmount));
                              setTopUpAmount("");
                            })}>
                            {actionLoading === "topUp" ? "..." : "Top Up"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cancel / Dispute */}
                    {isActive && (
                      <div className="action-section dispute-section">
                        {project.approvedCount === 0n && (
                          <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => {
                            if (!window.confirm("Cancel this project? Budget will be refunded proportionally to all funders.")) return;
                            handleAction("cancel", () => props.cancelProject(selectedId));
                          }} style={{ marginRight: 8 }}>
                            {actionLoading === "cancel" ? "..." : "Cancel Project"}
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" disabled={!!actionLoading} onClick={() => {
                          if (!window.confirm("Raise a dispute? This will freeze all milestone activity until the platform resolves it.")) return;
                          handleAction("dispute", () => props.raiseDispute(selectedId));
                        }}>
                          {actionLoading === "dispute" ? "..." : "Raise Dispute"}
                        </button>
                      </div>
                    )}

                    {/* Withdraw Surplus */}
                    {(isCompleted || project.status === ProjectStatus.Cancelled) && project.approvedCount < activeMsCount && (
                      <div className="action-section">
                        <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => handleAction("withdrawSurplus", () => props.withdrawUnclaimable(selectedId))}>
                          {actionLoading === "withdrawSurplus" ? "..." : "Withdraw Surplus Funds"}
                        </button>
                      </div>
                    )}

                    {/* Rate Developer */}
                    {isCompleted && !hasNoDev && !alreadyRated && (
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
                    {isCompleted && !hasNoDev && alreadyRated && (
                      <div className="action-section">
                        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Developer already rated for this project.</p>
                      </div>
                    )}
                  </>
                )}

                {/* === FUND (for non-owners viewing other projects) === */}
                {!isMyProject && isActive && remainingCap > 0n && (
                  <div className="action-section">
                    <h3>Fund This Project</h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: 6 }}>
                      Remaining capacity: {ethers.formatEther(remainingCap)} ETH
                    </p>
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

                {/* Milestone List (with approve for owner) */}
                <div className="milestones-section">
                  <h3>Milestone Progress</h3>
                  <MilestoneList milestones={milestones} project={project} role="client" account={props.account} actionLoading={actionLoading}
                    onApprove={isMyProject ? (i) => handleAction(`approve-${i}`, () => props.approveMilestone(selectedId, BigInt(i))) : undefined} />
                </div>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header"><h2>Client Dashboard</h2></div>
              <div className="panel-body">
                <p className="info-hint">Create a new project to get started, or select one to manage it.</p>
              </div>
            </div>
          )}
          <ActivityFeed events={props.activity} />
        </div>
      </div>
    </div>
  );
}

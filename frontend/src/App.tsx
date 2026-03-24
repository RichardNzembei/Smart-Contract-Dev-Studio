import { useState, useCallback, useEffect } from "react";
import { useContract } from "./hooks/useContract";
import { RoleSwitcher } from "./components/RoleSwitcher";
import { StudioDashboard } from "./components/dashboards/StudioDashboard";
import { DeveloperDashboard } from "./components/dashboards/DeveloperDashboard";
import { ClientDashboard } from "./components/dashboards/ClientDashboard";
import { NewProjectModal } from "./components/NewProjectModal";
import type { Role } from "./config/types";
import "./App.css";

interface DevDisplay {
  wallet: string;
  name: string;
  avgRating: number;
  ratingCount: number;
}

function App() {
  const [role, setRole] = useState<Role>("client");
  const [showNewProject, setShowNewProject] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [knownDevs, setKnownDevs] = useState<DevDisplay[]>([]);

  const {
    account,
    balance,
    connected,
    networkName,
    activity,
    connect,
    switchAccount,
    getProjectCount,
    getProject,
    getMilestone,
    getDeveloper,
    getDeveloperRating,
    registerDeveloper,
    createProject,
    addMilestone,
    assignDeveloper,
    submitMilestone,
    approveMilestone,
    raiseDispute,
    resolveDispute,
    rateDeveloper,
    fundProject,
    getProjectPayments,
    cancelProject,
    withdrawUnclaimable,
    getRegisteredDevelopers,
    withdrawFunds,
    getPendingWithdrawal,
    topUpBudget,
    getDisputeRaiser,
    rateStudio,
    getStudioRating,
    isProjectRated,
    isProjectStudioRated,
    getProjectFundingCap,
    getFunderContribution,
    proposeDeveloper,
    acceptAssignment,
    rejectAssignment,
    getProposedDeveloper,
    expireProject,
    getActiveMilestoneCount,
    setFundingCap,
  } = useContract();

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Discover registered developers dynamically from contract events
  useEffect(() => {
    if (!connected) return;
    async function loadDevs() {
      const addresses = await getRegisteredDevelopers();
      const devs: DevDisplay[] = [];
      for (const addr of addresses) {
        try {
          const dev = await getDeveloper(addr);
          if (dev.registered) {
            const rating = await getDeveloperRating(addr);
            devs.push({ wallet: addr, name: dev.name, avgRating: Number(rating.average), ratingCount: Number(rating.count) });
          }
        } catch { /* skip */ }
      }
      if (devs.length > 0) setKnownDevs(devs);
    }
    loadDevs();
  }, [connected, getRegisteredDevelopers, getDeveloper, getDeveloperRating]);

  // Switch accounts when role changes
  // Account mapping: client=#0, developer=#1, studio=#2
  const handleRoleChange = useCallback(
    (newRole: Role) => {
      setRole(newRole);
      const index = newRole === "client" ? 0 : newRole === "developer" ? 1 : 2;
      switchAccount(index);
    },
    [switchAccount]
  );

  // Track known devs from register events
  const handleRegisterDev = useCallback(
    async (name: string) => {
      await registerDeveloper(name);
      const dev = await getDeveloper(account);
      if (dev.registered) {
        const rating = await getDeveloperRating(account);
        setKnownDevs((prev) => {
          if (prev.some((d) => d.wallet.toLowerCase() === account.toLowerCase())) return prev;
          return [...prev, { wallet: account, name: dev.name, avgRating: Number(rating.average), ratingCount: Number(rating.count) }];
        });
      }
      refresh();
    },
    [registerDeveloper, getDeveloper, getDeveloperRating, account, refresh]
  );

  // Refresh dev list when things change
  useEffect(() => {
    async function refreshDevs() {
      const updated = await Promise.all(
        knownDevs.map(async (d) => {
          try {
            const rating = await getDeveloperRating(d.wallet);
            return { ...d, avgRating: Number(rating.average), ratingCount: Number(rating.count) };
          } catch { return d; }
        })
      );
      setKnownDevs(updated);
    }
    if (knownDevs.length > 0) refreshDevs();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <RoleSwitcher
        role={role}
        onRoleChange={handleRoleChange}
        account={account}
        balance={balance}
        connected={connected}
        onConnect={connect}
        networkName={networkName}
      />

      {role === "client" && (
        <ClientDashboard
          account={account}
          balance={balance}
          refreshKey={refreshKey}
          activity={activity}
          knownDevs={knownDevs}
          onNewProject={() => setShowNewProject(true)}
          getProjectCount={getProjectCount}
          getProject={getProject}
          getProjectPayments={getProjectPayments}
          getMilestone={getMilestone}
          getDeveloper={getDeveloper}
          getDeveloperRating={getDeveloperRating}
          addMilestone={addMilestone}
          approveMilestone={approveMilestone}
          proposeDeveloper={proposeDeveloper}
          assignDeveloper={assignDeveloper}
          rateDeveloper={rateDeveloper}
          cancelProject={cancelProject}
          withdrawUnclaimable={withdrawUnclaimable}
          isProjectRated={isProjectRated}
          setFundingCap={setFundingCap}
          topUpBudget={topUpBudget}
          getProjectFundingCap={getProjectFundingCap}
          getFunderContribution={getFunderContribution}
          getActiveMilestoneCount={getActiveMilestoneCount}
          fundProject={fundProject}
          raiseDispute={raiseDispute}
          withdrawFunds={withdrawFunds}
          getPendingWithdrawal={getPendingWithdrawal}
          onRefresh={refresh}
        />
      )}

      {role === "developer" && (
        <DeveloperDashboard
          account={account}
          balance={balance}
          refreshKey={refreshKey}
          activity={activity}
          getProjectCount={getProjectCount}
          getProject={getProject}
          getProjectPayments={getProjectPayments}
          getMilestone={getMilestone}
          getDeveloper={getDeveloper}
          getDeveloperRating={getDeveloperRating}
          registerDeveloper={handleRegisterDev}
          submitMilestone={submitMilestone}
          raiseDispute={raiseDispute}
          withdrawFunds={withdrawFunds}
          getPendingWithdrawal={getPendingWithdrawal}
          rateStudio={rateStudio}
          isProjectStudioRated={isProjectStudioRated}
          acceptAssignment={acceptAssignment}
          rejectAssignment={rejectAssignment}
          getProposedDeveloper={getProposedDeveloper}
          getActiveMilestoneCount={getActiveMilestoneCount}
          onRefresh={refresh}
        />
      )}

      {role === "studio" && (
        <StudioDashboard
          account={account}
          balance={balance}
          refreshKey={refreshKey}
          activity={activity}
          onRefresh={refresh}
          getProjectCount={getProjectCount}
          getProject={getProject}
          getProjectPayments={getProjectPayments}
          getMilestone={getMilestone}
          raiseDispute={raiseDispute}
          resolveDispute={resolveDispute}
          expireProject={expireProject}
          getDisputeRaiser={getDisputeRaiser}
          getStudioRating={getStudioRating}
          getActiveMilestoneCount={getActiveMilestoneCount}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          createProject={createProject}
          onCreated={refresh}
        />
      )}
    </div>
  );
}

export default App;

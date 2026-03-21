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
  const [role, setRole] = useState<Role>("studio");
  const [showNewProject, setShowNewProject] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [knownDevs, setKnownDevs] = useState<DevDisplay[]>([]);

  const {
    account,
    balance,
    connected,
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
  } = useContract();

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load known developers once connected
  useEffect(() => {
    if (!connected) return;
    async function loadDevs() {
      const knownAddresses = [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
      ];
      const devs: DevDisplay[] = [];
      for (const addr of knownAddresses) {
        try {
          const dev = await getDeveloper(addr);
          if (dev.registered) {
            const rating = await getDeveloperRating(addr);
            devs.push({ wallet: addr, name: dev.name, avgRating: Number(rating.average), ratingCount: Number(rating.count) });
          }
        } catch { /* not registered */ }
      }
      if (devs.length > 0) setKnownDevs(devs);
    }
    loadDevs();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch accounts when role changes
  const handleRoleChange = useCallback(
    (newRole: Role) => {
      setRole(newRole);
      const index = newRole === "studio" ? 0 : newRole === "developer" ? 1 : 2;
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
      />

      {role === "studio" && (
        <StudioDashboard
          account={account}
          balance={balance}
          refreshKey={refreshKey}
          activity={activity}
          knownDevs={knownDevs}
          onNewProject={() => setShowNewProject(true)}
          onRefresh={refresh}
          onRegisterDev={handleRegisterDev}
          getProjectCount={getProjectCount}
          getProject={getProject}
          getProjectPayments={getProjectPayments}
          getMilestone={getMilestone}
          assignDeveloper={assignDeveloper}
          addMilestone={addMilestone}
          approveMilestone={approveMilestone}
          raiseDispute={raiseDispute}
          resolveDispute={resolveDispute}
          rateDeveloper={rateDeveloper}
          cancelProject={cancelProject}
          withdrawUnclaimable={withdrawUnclaimable}
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
          onRefresh={refresh}
        />
      )}

      {role === "client" && (
        <ClientDashboard
          account={account}
          balance={balance}
          refreshKey={refreshKey}
          activity={activity}
          getProjectCount={getProjectCount}
          getProject={getProject}
          getProjectPayments={getProjectPayments}
          getMilestone={getMilestone}
          fundProject={fundProject}
          raiseDispute={raiseDispute}
          onRefresh={refresh}
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

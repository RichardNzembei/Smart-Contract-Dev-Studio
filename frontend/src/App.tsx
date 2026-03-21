import { useState, useCallback, useEffect } from "react";
import { useContract } from "./hooks/useContract";
import { RoleSwitcher } from "./components/RoleSwitcher";
import { ProjectList } from "./components/ProjectList";
import { ProjectDetail } from "./components/ProjectDetail";
import { DeveloperPanel } from "./components/DeveloperPanel";
import { ActivityFeed } from "./components/ActivityFeed";
import { NewProjectModal } from "./components/NewProjectModal";
import { InfoPanel } from "./components/InfoPanel";
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
  const [selectedProjectId, setSelectedProjectId] = useState<bigint | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [knownDevs, setKnownDevs] = useState<DevDisplay[]>([]);

  const {
    account,
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
  } = useContract();

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Auto-connect on mount + load known developers from chain
  useEffect(() => {
    connect().then(async () => {
      // Try to load known devs from Hardhat test accounts
      const knownAddresses = [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Account 1 — Alice
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Account 2 — Bob
      ];
      const devs: typeof knownDevs = [];
      for (const addr of knownAddresses) {
        try {
          const dev = await getDeveloper(addr);
          if (dev.registered) {
            const rating = await getDeveloperRating(addr);
            devs.push({
              wallet: addr,
              name: dev.name,
              avgRating: Number(rating.average),
              ratingCount: Number(rating.count),
            });
          }
        } catch { /* not registered yet */ }
      }
      if (devs.length > 0) setKnownDevs(devs);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch accounts when role changes (studio=0, dev=1, client=2)
  const handleRoleChange = useCallback(
    (newRole: Role) => {
      setRole(newRole);
      const index = newRole === "studio" ? 0 : newRole === "developer" ? 1 : 2;
      switchAccount(index);
      setSelectedProjectId(null);
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
          return [
            ...prev,
            {
              wallet: account,
              name: dev.name,
              avgRating: Number(rating.average),
              ratingCount: Number(rating.count),
            },
          ];
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
          } catch {
            return d;
          }
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
        connected={connected}
        onConnect={connect}
      />
      <main className="main-layout">
        <div className="left-column">
          <ProjectList
            role={role}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onNewProject={() => setShowNewProject(true)}
            getProjectCount={getProjectCount}
            getProject={getProject}
            refreshKey={refreshKey}
          />
          <DeveloperPanel
            role={role}
            connected={connected}
            registerDeveloper={handleRegisterDev}
            knownDevs={knownDevs}
          />
        </div>
        <div className="right-column">
          {selectedProjectId !== null ? (
            <ProjectDetail
              projectId={selectedProjectId}
              role={role}
              account={account}
              getProject={getProject}
              getMilestone={getMilestone}
              submitMilestone={submitMilestone}
              approveMilestone={approveMilestone}
              raiseDispute={raiseDispute}
              resolveDispute={resolveDispute}
              rateDeveloper={rateDeveloper}
              assignDeveloper={assignDeveloper}
              addMilestone={addMilestone}
              onRefresh={refresh}
              refreshKey={refreshKey}
            />
          ) : (
            <InfoPanel role={role} />
          )}
          <ActivityFeed events={activity} />
        </div>
      </main>
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

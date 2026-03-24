import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, DEVSTUDIO_ABI, RPC_URL } from "../config/contract";
import type { Project, Milestone, Developer, ActivityEvent, ProjectPayments } from "../config/types";

export function useContract() {
  const [, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [readContract, setReadContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [studioAddress, setStudioAddress] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [networkName, setNetworkName] = useState("");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  // Initialize read-only provider
  useEffect(() => {
    const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
    const rc = new ethers.Contract(CONTRACT_ADDRESS, DEVSTUDIO_ABI, rpcProvider);
    setReadContract(rc);
    setProvider(rpcProvider);

    rc.studio().then((addr: string) => setStudioAddress(addr)).catch(() => {});
  }, []);

  const addActivity = useCallback((type: string, description: string, detail: string) => {
    setActivity(prev => [{
      type,
      description,
      detail,
      timestamp: new Date(),
    }, ...prev].slice(0, 50));
  }, []);

  const fetchBalance = useCallback(async (rpcProvider: ethers.JsonRpcProvider, addr: string) => {
    try {
      const raw = await rpcProvider.getBalance(addr);
      setBalance(parseFloat(ethers.formatEther(raw)).toFixed(4));
    } catch {
      setBalance("");
    }
  }, []);

  // Connect directly to Hardhat node via JSON-RPC (no MetaMask)
  const connect = useCallback(async () => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
      const s = await rpcProvider.getSigner(0);
      const addr = await s.getAddress();
      const c = new ethers.Contract(CONTRACT_ADDRESS, DEVSTUDIO_ABI, s);
      setProvider(rpcProvider);
      setSigner(s);
      setContract(c);
      setAccount(addr);
      setConnected(true);
      fetchBalance(rpcProvider, addr);

      const studioAddr = await c.studio();
      setStudioAddress(studioAddr);

      const net = await rpcProvider.getNetwork();
      const chainId = Number(net.chainId);
      const names: Record<number, string> = { 1: "Mainnet", 5: "Goerli", 11155111: "Sepolia", 31337: "Hardhat Local", 10: "Optimism", 42161: "Arbitrum" };
      setNetworkName(names[chainId] || `Chain ${chainId}`);
    } catch (err) {
      console.error("Connection failed:", err);
    }
  }, [fetchBalance]);

  // Switch account (for role demo — uses JSON-RPC signers)
  const switchAccount = useCallback(async (index: number) => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
      const s = await rpcProvider.getSigner(index);
      const addr = await s.getAddress();
      const c = new ethers.Contract(CONTRACT_ADDRESS, DEVSTUDIO_ABI, s);
      setProvider(rpcProvider);
      setSigner(s);
      setContract(c);
      setAccount(addr);
      setConnected(true);
      fetchBalance(rpcProvider, addr);
    } catch (err) {
      console.error("Switch account failed:", err);
    }
  }, [fetchBalance]);

  // ──── Read Functions ────
  const getProjectCount = useCallback(async (): Promise<bigint> => {
    const c = readContract || contract;
    if (!c) return 0n;
    return c.projectCount();
  }, [readContract, contract]);

  const getProject = useCallback(async (id: bigint): Promise<Project> => {
    const c = readContract || contract;
    if (!c) throw new Error("Not connected");
    const raw = await c.getProject(id);
    return {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      budget: raw.budget,
      deadline: raw.deadline,
      client: raw.client,
      developer: raw.developer,
      status: Number(raw.status) as Project["status"],
      milestoneCount: raw.milestoneCount,
      approvedCount: raw.approvedCount,
    };
  }, [readContract, contract]);

  const getMilestone = useCallback(async (projectId: bigint, index: bigint): Promise<Milestone> => {
    const c = readContract || contract;
    if (!c) throw new Error("Not connected");
    const raw = await c.getMilestone(projectId, index);
    return {
      title: raw.title,
      value: raw.value,
      deadline: raw.deadline,
      status: Number(raw.status) as Milestone["status"],
    };
  }, [readContract, contract]);

  const getDeveloper = useCallback(async (wallet: string): Promise<Developer> => {
    const c = readContract || contract;
    if (!c) throw new Error("Not connected");
    return c.getDeveloper(wallet);
  }, [readContract, contract]);

  const getDeveloperRating = useCallback(async (wallet: string): Promise<{ average: bigint; count: bigint }> => {
    const c = readContract || contract;
    if (!c) throw new Error("Not connected");
    const [average, count] = await c.getDeveloperRating(wallet);
    return { average, count };
  }, [readContract, contract]);

  // ──── Write Functions ────
  const registerDeveloper = useCallback(async (name: string) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.registerDeveloper(name);
    await tx.wait();
    addActivity("DeveloperRegistered", `${name} registered`, account.slice(0, 6) + "..." + account.slice(-4));
  }, [contract, account, addActivity]);

  const createProject = useCallback(async (title: string, description: string, deadline: bigint, budgetWei: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.createProject(title, description, deadline, { value: budgetWei });
    await tx.wait();
    addActivity("ProjectCreated", `${title} created`, `${ethers.formatEther(budgetWei)} ETH locked`);
  }, [contract, addActivity]);

  const addMilestone = useCallback(async (projectId: bigint, title: string, value: bigint, deadline: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.addMilestone(projectId, title, value, deadline);
    await tx.wait();
    addActivity("MilestoneAdded", `Milestone "${title}" added`, `${ethers.formatEther(value)} ETH`);
  }, [contract, addActivity]);

  const assignDeveloper = useCallback(async (projectId: bigint, devAddress: string) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.assignDeveloper(projectId, devAddress);
    await tx.wait();
    addActivity("DeveloperAssigned", `Developer assigned to project #${projectId}`, devAddress.slice(0, 6) + "..." + devAddress.slice(-4));
  }, [contract, addActivity]);

  const submitMilestone = useCallback(async (projectId: bigint, milestoneIndex: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.submitMilestone(projectId, milestoneIndex);
    await tx.wait();
    addActivity("MilestoneSubmitted", `Milestone #${milestoneIndex} submitted`, `Project #${projectId}`);
  }, [contract, addActivity]);

  const approveMilestone = useCallback(async (projectId: bigint, milestoneIndex: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.approveMilestone(projectId, milestoneIndex);
    await tx.wait();
    addActivity("MilestoneApproved", `Milestone #${milestoneIndex} approved`, `Project #${projectId}`);
  }, [contract, addActivity]);

  const raiseDispute = useCallback(async (projectId: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.raiseDispute(projectId);
    await tx.wait();
    addActivity("DisputeRaised", `Dispute raised on project #${projectId}`, account.slice(0, 6) + "...");
  }, [contract, account, addActivity]);

  const resolveDispute = useCallback(async (projectId: bigint, inFavorOfDev: boolean) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.resolveDispute(projectId, inFavorOfDev);
    await tx.wait();
    addActivity("DisputeResolved", `Dispute resolved on project #${projectId}`, inFavorOfDev ? "In favor of developer" : "In favor of studio");
  }, [contract, addActivity]);

  const rateDeveloper = useCallback(async (projectId: bigint, rating: number) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.rateDeveloper(projectId, rating);
    await tx.wait();
    addActivity("DeveloperRated", `Developer rated ${rating}/5`, `Project #${projectId}`);
  }, [contract, addActivity]);

  const fundProject = useCallback(async (projectId: bigint, amountWei: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.fundProject(projectId, { value: amountWei });
    await tx.wait();
    addActivity("ProjectFunded", `Project #${projectId} funded`, `${ethers.formatEther(amountWei)} ETH`);
  }, [contract, addActivity]);

  const getProjectPayments = useCallback(async (projectId: bigint): Promise<ProjectPayments> => {
    const c = readContract || contract;
    if (!c) throw new Error("Not connected");
    const [totalBudget, clientFunded, paidToDev, remaining] = await c.getProjectPayments(projectId);
    return { totalBudget, clientFunded, paidToDev, remaining };
  }, [readContract, contract]);

  // Discover registered developers from contract events
  const getRegisteredDevelopers = useCallback(async (): Promise<string[]> => {
    const c = readContract || contract;
    if (!c) return [];
    try {
      const filter = c.filters.DeveloperRegistered();
      const events = await c.queryFilter(filter, 0, "latest");
      const addresses = events.map((e: any) => e.args?.[0] || e.args?.wallet).filter(Boolean);
      return [...new Set(addresses)] as string[];
    } catch {
      return [];
    }
  }, [readContract, contract]);

  const cancelProject = useCallback(async (projectId: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.cancelProject(projectId);
    await tx.wait();
    addActivity("ProjectCancelled", `Project #${projectId} cancelled`, "Budget refunded to studio");
  }, [contract, addActivity]);

  const withdrawUnclaimable = useCallback(async (projectId: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.withdrawUnclaimable(projectId);
    await tx.wait();
    addActivity("UnclaimableWithdrawn", `Unclaimable funds withdrawn`, `Project #${projectId}`);
  }, [contract, addActivity]);

  // C1: Pull-based withdrawal
  const withdrawFunds = useCallback(async () => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.withdraw();
    await tx.wait();
    addActivity("Withdrawal", `Funds withdrawn`, account.slice(0, 6) + "...");
  }, [contract, account, addActivity]);

  const getPendingWithdrawal = useCallback(async (address: string): Promise<bigint> => {
    const c = readContract || contract;
    if (!c) return 0n;
    return c.pendingWithdrawals(address);
  }, [readContract, contract]);

  // C3: Reassign developer
  const reassignDeveloper = useCallback(async (projectId: bigint, newDevAddress: string) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.reassignDeveloper(projectId, newDevAddress);
    await tx.wait();
    addActivity("DeveloperReassigned", `Developer reassigned on project #${projectId}`, newDevAddress.slice(0, 6) + "...");
  }, [contract, addActivity]);

  // C4: Studio top-up budget
  const topUpBudget = useCallback(async (projectId: bigint, amountWei: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.topUpBudget(projectId, { value: amountWei });
    await tx.wait();
    addActivity("BudgetIncreased", `Budget increased on project #${projectId}`, `${ethers.formatEther(amountWei)} ETH`);
  }, [contract, addActivity]);

  // C5: Batch approve milestones
  const batchApproveMilestones = useCallback(async (projectId: bigint, indices: bigint[]) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.batchApproveMilestones(projectId, indices);
    await tx.wait();
    addActivity("MilestoneApproved", `${indices.length} milestones approved`, `Project #${projectId}`);
  }, [contract, addActivity]);

  // H2: Edit milestone
  const editMilestone = useCallback(async (projectId: bigint, index: bigint, title: string, value: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.editMilestone(projectId, index, title, value);
    await tx.wait();
    addActivity("MilestoneEdited", `Milestone #${index} edited`, `Project #${projectId}`);
  }, [contract, addActivity]);

  // H2: Remove milestone
  const removeMilestone = useCallback(async (projectId: bigint, index: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.removeMilestone(projectId, index);
    await tx.wait();
    addActivity("MilestoneRemoved", `Milestone #${index} removed`, `Project #${projectId}`);
  }, [contract, addActivity]);

  // H4: Extend deadline
  const extendDeadline = useCallback(async (projectId: bigint, newDeadline: bigint) => {
    if (!contract) throw new Error("Not connected");
    const tx = await contract.extendDeadline(projectId, newDeadline);
    await tx.wait();
    addActivity("DeadlineExtended", `Deadline extended on project #${projectId}`, new Date(Number(newDeadline) * 1000).toLocaleDateString());
  }, [contract, addActivity]);

  // H1: Get weighted rating
  const getWeightedRating = useCallback(async (wallet: string): Promise<{ weightedAverage: bigint; totalWeight: bigint; count: bigint }> => {
    const c = readContract || contract;
    if (!c) throw new Error("Not connected");
    const [weightedAverage, totalWeight, count] = await c.getWeightedRating(wallet);
    return { weightedAverage, totalWeight, count };
  }, [readContract, contract]);

  return {
    account,
    balance,
    studioAddress,
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
    reassignDeveloper,
    topUpBudget,
    batchApproveMilestones,
    editMilestone,
    removeMilestone,
    extendDeadline,
    getWeightedRating,
  };
}

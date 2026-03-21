import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, DEVSTUDIO_ABI, RPC_URL } from "../config/contract";
import type { Project, Milestone, Developer, ActivityEvent } from "../config/types";

export function useContract() {
  const [, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [readContract, setReadContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [studioAddress, setStudioAddress] = useState<string>("");
  const [connected, setConnected] = useState(false);
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

      const studioAddr = await c.studio();
      setStudioAddress(studioAddr);
    } catch (err) {
      console.error("Connection failed:", err);
    }
  }, []);

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
    } catch (err) {
      console.error("Switch account failed:", err);
    }
  }, []);

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

  return {
    account,
    studioAddress,
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
  };
}

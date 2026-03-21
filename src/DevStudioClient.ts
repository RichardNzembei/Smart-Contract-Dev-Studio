import {
  type PublicClient,
  type WalletClient,
  type GetContractReturnType,
  type Abi,
  getContract,
  parseEther,
} from "viem";
import type { Developer, Milestone, Project } from "./types.js";

export class DevStudioClient {
  private contract: GetContractReturnType<Abi, { public: PublicClient; wallet: WalletClient }>;

  constructor(
    address: `0x${string}`,
    abi: Abi,
    publicClient: PublicClient,
    walletClient: WalletClient,
  ) {
    this.contract = getContract({
      address,
      abi,
      client: { public: publicClient, wallet: walletClient },
    });
  }

  // ──── Developer ────
  async registerDeveloper(name: string) {
    return this.contract.write.registerDeveloper([name]);
  }

  async getDeveloper(wallet: `0x${string}`): Promise<Developer> {
    return this.contract.read.getDeveloper([wallet]) as Promise<Developer>;
  }

  async getDeveloperRating(
    wallet: `0x${string}`,
  ): Promise<{ average: bigint; count: bigint }> {
    const [average, count] = (await this.contract.read.getDeveloperRating([
      wallet,
    ])) as [bigint, bigint];
    return { average, count };
  }

  // ──── Project ────
  async createProject(
    title: string,
    description: string,
    deadline: bigint,
    budgetEth: string,
  ) {
    return this.contract.write.createProject([title, description, deadline], {
      value: parseEther(budgetEth),
    });
  }

  async getProject(projectId: bigint): Promise<Project> {
    return this.contract.read.getProject([projectId]) as Promise<Project>;
  }

  // ──── Milestone ────
  async addMilestone(
    projectId: bigint,
    title: string,
    value: bigint,
    deadline: bigint,
  ) {
    return this.contract.write.addMilestone([
      projectId,
      title,
      value,
      deadline,
    ]);
  }

  async getMilestone(
    projectId: bigint,
    milestoneIndex: bigint,
  ): Promise<Milestone> {
    return this.contract.read.getMilestone([
      projectId,
      milestoneIndex,
    ]) as Promise<Milestone>;
  }

  // ──── Assignment & Workflow ────
  async assignDeveloper(projectId: bigint, developer: `0x${string}`) {
    return this.contract.write.assignDeveloper([projectId, developer]);
  }

  async submitMilestone(projectId: bigint, milestoneIndex: bigint) {
    return this.contract.write.submitMilestone([projectId, milestoneIndex]);
  }

  async approveMilestone(projectId: bigint, milestoneIndex: bigint) {
    return this.contract.write.approveMilestone([projectId, milestoneIndex]);
  }

  // ──── Disputes ────
  async raiseDispute(projectId: bigint) {
    return this.contract.write.raiseDispute([projectId]);
  }

  async resolveDispute(projectId: bigint, inFavorOfDeveloper: boolean) {
    return this.contract.write.resolveDispute([projectId, inFavorOfDeveloper]);
  }

  // ──── Reputation ────
  async rateDeveloper(projectId: bigint, rating: number) {
    return this.contract.write.rateDeveloper([projectId, rating]);
  }
}

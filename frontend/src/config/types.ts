export const ProjectStatus = {
  Active: 0,
  Completed: 1,
  Disputed: 2,
  Cancelled: 3,
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const MilestoneStatus = {
  Pending: 0,
  Submitted: 1,
  Approved: 2,
  Disputed: 3,
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export type Role = "studio" | "developer" | "client";

export interface Developer {
  wallet: string;
  name: string;
  totalRating: bigint;
  ratingCount: bigint;
  registered: boolean;
}

export interface Project {
  id: bigint;
  title: string;
  description: string;
  budget: bigint;
  deadline: bigint;
  client: string;
  developer: string;
  status: ProjectStatus;
  milestoneCount: bigint;
  approvedCount: bigint;
}

export interface ProjectPayments {
  totalBudget: bigint;
  clientFunded: bigint;
  paidToDev: bigint;
  remaining: bigint;
}

export interface Milestone {
  title: string;
  value: bigint;
  deadline: bigint;
  status: MilestoneStatus;
}

export interface ActivityEvent {
  type: string;
  description: string;
  detail: string;
  timestamp: Date;
}

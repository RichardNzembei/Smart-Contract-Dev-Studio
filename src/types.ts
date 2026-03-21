export enum ProjectStatus {
  Active = 0,
  Completed = 1,
  Disputed = 2,
  Cancelled = 3,
}

export enum MilestoneStatus {
  Pending = 0,
  Submitted = 1,
  Approved = 2,
  Disputed = 3,
}

export interface Developer {
  wallet: `0x${string}`;
  name: string;
  totalRating: bigint;
  ratingCount: bigint;
  registered: boolean;
}

export interface Milestone {
  title: string;
  value: bigint;
  deadline: bigint;
  status: MilestoneStatus;
}

export interface Project {
  id: bigint;
  title: string;
  description: string;
  budget: bigint;
  deadline: bigint;
  developer: `0x${string}`;
  status: ProjectStatus;
  milestoneCount: bigint;
  approvedCount: bigint;
}

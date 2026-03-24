import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type { Project, ProjectPayments } from "../config/types";
import { ProjectStatus } from "../config/types";

type Filter = "all" | "assigned" | "funded";

interface UseProjectsProps {
  filter: Filter;
  account: string;
  refreshKey: number;
  getProjectCount: () => Promise<bigint>;
  getProject: (id: bigint) => Promise<Project>;
  getProjectPayments: (id: bigint) => Promise<ProjectPayments>;
}

export function useProjects({
  filter,
  account,
  refreshKey,
  getProjectCount,
  getProject,
  getProjectPayments,
}: UseProjectsProps) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, ProjectPayments>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const count = await getProjectCount();
      const indices = Array.from({ length: Number(count) }, (_, i) => BigInt(i));

      // Load all projects in parallel
      const list = await Promise.all(indices.map((i) => getProject(i)));

      // Load all payments in parallel
      const paymentResults = await Promise.allSettled(
        indices.map((i) => getProjectPayments(i))
      );
      const payments: Record<string, ProjectPayments> = {};
      paymentResults.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          payments[indices[idx].toString()] = result.value;
        }
      });

      setAllProjects(list);
      setPaymentsMap(payments);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, [getProjectCount, getProject, getProjectPayments]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Filter projects based on role
  const lowerAccount = account.toLowerCase();

  const projects = allProjects.filter((p) => {
    if (filter === "all") return true;
    if (filter === "assigned") {
      return (
        p.developer.toLowerCase() === lowerAccount ||
        (p.developer === ethers.ZeroAddress && p.status === ProjectStatus.Active)
      );
    }
    if (filter === "funded") {
      return p.client.toLowerCase() === lowerAccount ||
        (p.client === ethers.ZeroAddress && p.status === ProjectStatus.Active);
    }
    return true;
  });

  // Convenience sub-lists
  const myProjects = allProjects.filter(
    (p) => p.developer.toLowerCase() === lowerAccount
  );
  const availableProjects = allProjects.filter(
    (p) => p.developer === ethers.ZeroAddress && p.status === ProjectStatus.Active
  );
  const fundedProjects = allProjects.filter(
    (p) => p.client.toLowerCase() === lowerAccount
  );
  const unfundedProjects = allProjects.filter(
    (p) => p.client === ethers.ZeroAddress && p.status === ProjectStatus.Active
  );

  // Aggregate stats
  const totalBudget = allProjects.reduce((sum, p) => sum + p.budget, 0n);
  const activeCount = allProjects.filter((p) => p.status === ProjectStatus.Active).length;
  const completedCount = allProjects.filter((p) => p.status === ProjectStatus.Completed).length;
  const disputedCount = allProjects.filter((p) => p.status === ProjectStatus.Disputed).length;

  const totalPaidToDev = Object.values(paymentsMap).reduce(
    (sum, p) => sum + p.paidToDev, 0n
  );
  const totalClientFunded = Object.values(paymentsMap).reduce(
    (sum, p) => sum + p.clientFunded, 0n
  );

  return {
    projects,
    allProjects,
    myProjects,
    availableProjects,
    fundedProjects,
    unfundedProjects,
    paymentsMap,
    loading,
    stats: {
      total: allProjects.length,
      activeCount,
      completedCount,
      disputedCount,
      totalBudget,
      totalPaidToDev,
      totalClientFunded,
    },
    reload: load,
  };
}

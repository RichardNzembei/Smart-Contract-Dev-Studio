import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type { Project, Role } from "../config/types";
import { ProjectStatus } from "../config/types";

interface Props {
  role: Role;
  selectedProjectId: bigint | null;
  onSelectProject: (id: bigint) => void;
  onNewProject: () => void;
  getProjectCount: () => Promise<bigint>;
  getProject: (id: bigint) => Promise<Project>;
  refreshKey: number;
}

const STATUS_LABELS: Record<number, string> = {
  [ProjectStatus.Active]: "Active",
  [ProjectStatus.Completed]: "Completed",
  [ProjectStatus.Disputed]: "Disputed",
  [ProjectStatus.Cancelled]: "Cancelled",
};

const STATUS_CLASSES: Record<number, string> = {
  [ProjectStatus.Active]: "status-active",
  [ProjectStatus.Completed]: "status-completed",
  [ProjectStatus.Disputed]: "status-disputed",
  [ProjectStatus.Cancelled]: "status-cancelled",
};

export function ProjectList({ role, selectedProjectId, onSelectProject, onNewProject, getProjectCount, getProject, refreshKey }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const count = await getProjectCount();
      const list: Project[] = [];
      for (let i = 0n; i < count; i++) {
        const p = await getProject(i);
        list.push(p);
      }
      setProjects(list);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, [getProjectCount, getProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, refreshKey]);

  return (
    <div className="panel project-list">
      <div className="panel-header">
        <h2>Projects</h2>
        {role === "studio" && (
          <button className="btn btn-primary btn-sm" onClick={onNewProject}>
            + New Project
          </button>
        )}
      </div>
      <div className="panel-body">
        {loading ? (
          <div className="empty-state">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">No projects yet. {role === "studio" ? "Create one!" : ""}</div>
        ) : (
          projects.map((p) => (
            <div
              key={Number(p.id)}
              className={`project-card ${selectedProjectId === p.id ? "selected" : ""}`}
              onClick={() => onSelectProject(p.id)}
            >
              <div className="project-card-header">
                <h3>{p.title}</h3>
                <span className={`status-badge ${STATUS_CLASSES[p.status]}`}>
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
              <p className="project-desc">{p.description}</p>
              <div className="project-meta">
                <span>Budget: {ethers.formatEther(p.budget)} ETH</span>
                <span>
                  {Number(p.approvedCount)} / {Number(p.milestoneCount)} milestones
                </span>
              </div>
              {p.developer !== ethers.ZeroAddress && (
                <div className="project-dev">
                  Dev: {p.developer.slice(0, 6)}...{p.developer.slice(-4)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

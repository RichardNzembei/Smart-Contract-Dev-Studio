import { useState } from "react";
import { ethers } from "ethers";

interface Props {
  onClose: () => void;
  createProject: (title: string, description: string, deadline: bigint, budgetWei: bigint) => Promise<void>;
  onCreated: () => void;
}

export function NewProjectModal({ onClose, createProject, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !budget || !days) return;

    setLoading(true);
    setError("");
    try {
      const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseInt(days) * 86400);
      const budgetWei = ethers.parseEther(budget);
      await createProject(title, description, deadlineTimestamp, budgetWei);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Create new project">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project name" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" rows={3} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Budget (ETH)</label>
              <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="1.0" required />
            </div>
            <div className="form-group">
              <label>Deadline (days from now)</label>
              <input type="number" value={days} onChange={(e) => setDays(e.target.value)} min="1" required />
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create & Lock ETH"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

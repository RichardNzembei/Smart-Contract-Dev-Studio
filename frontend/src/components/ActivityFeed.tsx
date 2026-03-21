import type { ActivityEvent } from "../config/types";

interface Props {
  events: ActivityEvent[];
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const EVENT_ICONS: Record<string, string> = {
  ProjectCreated: "📋",
  MilestoneAdded: "📌",
  MilestoneSubmitted: "📤",
  MilestoneApproved: "✅",
  DeveloperRegistered: "👤",
  DeveloperAssigned: "🔗",
  DeveloperRated: "⭐",
  DisputeRaised: "⚠️",
  DisputeResolved: "⚖️",
};

export function ActivityFeed({ events }: Props) {
  return (
    <div className="panel activity-panel">
      <div className="panel-header">
        <h2>Blockchain Activity</h2>
      </div>
      <div className="panel-body">
        {events.length === 0 ? (
          <div className="empty-state">No activity yet. Interact with the contract to see events here.</div>
        ) : (
          <div className="activity-list">
            {events.map((evt, i) => (
              <div key={i} className="activity-item">
                <span className="activity-icon">{EVENT_ICONS[evt.type] || "📝"}</span>
                <div className="activity-content">
                  <div className="activity-type">{evt.type}</div>
                  <div className="activity-desc">{evt.description}</div>
                  <div className="activity-detail">{evt.detail}</div>
                </div>
                <span className="activity-time">{timeAgo(evt.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

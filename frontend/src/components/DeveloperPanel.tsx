import { useState, useEffect } from "react";

interface DevDisplay {
  wallet: string;
  name: string;
  avgRating: number;
  ratingCount: number;
}

interface Props {
  role: string;
  connected: boolean;
  registerDeveloper: (name: string) => Promise<void>;
  knownDevs: DevDisplay[];
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const stars = [];
  for (let i = 0; i < 5; i++) {
    stars.push(
      <span key={i} className={i < full ? "star filled" : "star empty"}>★</span>
    );
  }
  return <span className="stars">{stars}</span>;
}

export function DeveloperPanel({ role, connected, registerDeveloper, knownDevs }: Props) {
  const [devName, setDevName] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  // Reset registered state when role changes
  useEffect(() => {
    setRegistered(false);
  }, [role]);

  const handleRegister = async () => {
    if (!devName.trim()) return;
    setLoading(true);
    try {
      await registerDeveloper(devName);
      setRegistered(true);
      setDevName("");
    } catch (err: any) {
      alert(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel dev-panel">
      <div className="panel-header">
        <h2>Developers</h2>
      </div>
      <div className="panel-body">
        {knownDevs.length > 0 ? (
          <div className="dev-list">
            {knownDevs.map((d) => (
              <div key={d.wallet} className="dev-card">
                <div className="dev-info">
                  <span className="dev-name">{d.name}</span>
                  <span className="dev-addr">{d.wallet.slice(0, 6)}...{d.wallet.slice(-2)}</span>
                </div>
                <div className="dev-rating">
                  {renderStars(d.avgRating)}
                  <span className="rating-count">{d.ratingCount} ratings</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No registered developers yet</div>
        )}

        {role === "developer" && connected && !registered && (
          <div className="register-form">
            <h3>Register as Developer</h3>
            <div className="inline-form">
              <input
                type="text"
                placeholder="Your name"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={loading || !devName.trim()}
                onClick={handleRegister}
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

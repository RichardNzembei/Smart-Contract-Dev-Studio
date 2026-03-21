import type { Role } from "../config/types";

interface Props {
  role: Role;
  onRoleChange: (role: Role) => void;
  account: string;
  balance: string;
  connected: boolean;
  onConnect: () => void;
}

const ROLE_LABELS: Record<Role, string> = {
  studio: "Studio Owner",
  developer: "Developer",
  client: "Client",
};

const ROLE_COLORS: Record<Role, string> = {
  studio: "var(--accent)",
  developer: "var(--green)",
  client: "var(--blue)",
};

export function RoleSwitcher({ role, onRoleChange, account, balance, connected, onConnect }: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">DevStudio</h1>
        <span className="logo-sub">Smart Contract Workspace</span>
      </div>
      <div className="header-right">
        <div className="role-buttons">
          {(["studio", "developer", "client"] as Role[]).map((r) => (
            <button
              key={r}
              className={`role-btn ${role === r ? "active" : ""}`}
              style={role === r ? { background: ROLE_COLORS[r] } : undefined}
              onClick={() => onRoleChange(r)}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        {connected ? (
          <div className="wallet-badge">
            <span className="wallet-dot" style={{ background: ROLE_COLORS[role] }} />
            <div className="wallet-info">
              <span className="wallet-role-label">{ROLE_LABELS[role]}</span>
              <span className="wallet-addr">{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
            {balance && <span className="wallet-balance">{balance} ETH</span>}
          </div>
        ) : (
          <button className="connect-btn" onClick={onConnect}>
            Connect
          </button>
        )}
      </div>
    </header>
  );
}

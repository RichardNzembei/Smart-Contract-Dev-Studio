import type { Role } from "../config/types";
import { CopyAddress } from "./shared/CopyAddress";

interface Props {
  role: Role;
  onRoleChange: (role: Role) => void;
  account: string;
  balance: string;
  connected: boolean;
  onConnect: () => void;
  networkName?: string;
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

export function RoleSwitcher({ role, onRoleChange, account, balance, connected, onConnect, networkName }: Props) {
  return (
    <header className="header" role="banner">
      <div className="header-left">
        <h1 className="logo">DevStudio</h1>
        <span className="logo-sub">Smart Contract Workspace</span>
      </div>
      <div className="header-right">
        <nav className="role-buttons" aria-label="Role selection">
          {(["studio", "developer", "client"] as Role[]).map((r) => (
            <button
              key={r}
              className={`role-btn ${role === r ? "active" : ""}`}
              style={role === r ? { background: ROLE_COLORS[r] } : undefined}
              onClick={() => onRoleChange(r)}
              aria-label={`Switch to ${ROLE_LABELS[r]} role`}
              aria-pressed={role === r}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </nav>
        {connected ? (
          <div className="wallet-badge" aria-label={`Connected as ${ROLE_LABELS[role]}`}>
            <span className="wallet-dot" style={{ background: ROLE_COLORS[role] }} />
            <div className="wallet-info">
              <span className="wallet-role-label">{ROLE_LABELS[role]}</span>
              <span className="wallet-addr"><CopyAddress address={account} /></span>
            </div>
            {balance && <span className="wallet-balance">{balance} ETH</span>}
            {networkName && <span style={{ fontSize: "9px", color: "var(--text-muted)", marginLeft: 6 }}>{networkName}</span>}
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

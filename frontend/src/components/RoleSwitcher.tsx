import type { Role } from "../config/types";

interface Props {
  role: Role;
  onRoleChange: (role: Role) => void;
  account: string;
  connected: boolean;
  onConnect: () => void;
}

export function RoleSwitcher({ role, onRoleChange, account, connected, onConnect }: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">DevStudio</h1>
        <span className="logo-sub">Smart Contract Workspace</span>
      </div>
      <div className="header-right">
        <div className="role-buttons">
          <button
            className={`role-btn ${role === "studio" ? "active" : ""}`}
            onClick={() => onRoleChange("studio")}
          >
            Studio Owner
          </button>
          <button
            className={`role-btn ${role === "developer" ? "active" : ""}`}
            onClick={() => onRoleChange("developer")}
          >
            Developer
          </button>
          <button
            className={`role-btn ${role === "client" ? "active" : ""}`}
            onClick={() => onRoleChange("client")}
          >
            Client
          </button>
        </div>
        {connected ? (
          <div className="wallet-badge">
            <span className="wallet-dot" />
            {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        ) : (
          <button className="connect-btn" onClick={onConnect}>
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

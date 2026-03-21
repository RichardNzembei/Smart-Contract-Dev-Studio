import { ethers } from "ethers";
import type { ProjectPayments, Role } from "../../config/types";

interface Props {
  payments: ProjectPayments;
  perspective: Role;
}

export function PaymentFlowCard({ payments, perspective }: Props) {
  if (perspective === "developer") {
    return (
      <div className="payment-flow">
        <h3>Earnings</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Earned So Far</label>
            <span style={{ color: "var(--green)", fontSize: "16px" }}>
              {ethers.formatEther(payments.paidToDev)} ETH
            </span>
          </div>
          <div className="detail-item">
            <label>Remaining to Earn</label>
            <span style={{ color: "var(--yellow)" }}>
              {ethers.formatEther(payments.remaining)} ETH
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (perspective === "client") {
    return (
      <div className="payment-flow">
        <h3>My Funding</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>I Funded</label>
            <span style={{ color: "var(--blue)", fontSize: "16px" }}>
              {ethers.formatEther(payments.clientFunded)} ETH
            </span>
          </div>
          <div className="detail-item">
            <label>Total Budget</label>
            <span>{ethers.formatEther(payments.totalBudget)} ETH</span>
          </div>
          <div className="detail-item">
            <label>Paid to Developer</label>
            <span style={{ color: payments.paidToDev > 0n ? "var(--green)" : "var(--text-muted)" }}>
              {ethers.formatEther(payments.paidToDev)} ETH
            </span>
          </div>
          <div className="detail-item">
            <label>Still in Contract</label>
            <span style={{ color: payments.remaining > 0n ? "var(--yellow)" : "var(--text-muted)" }}>
              {ethers.formatEther(payments.remaining)} ETH
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Studio — full view
  return (
    <div className="payment-flow">
      <h3>Payment Flow</h3>
      <div className="detail-grid">
        <div className="detail-item">
          <label>Studio Funded</label>
          <span>{ethers.formatEther(payments.totalBudget - payments.clientFunded)} ETH</span>
        </div>
        <div className="detail-item">
          <label>Client Funded</label>
          <span style={{ color: payments.clientFunded > 0n ? "var(--blue)" : "var(--text-muted)" }}>
            {ethers.formatEther(payments.clientFunded)} ETH
          </span>
        </div>
        <div className="detail-item">
          <label>Paid to Dev</label>
          <span style={{ color: payments.paidToDev > 0n ? "var(--green)" : "var(--text-muted)" }}>
            {ethers.formatEther(payments.paidToDev)} ETH
          </span>
        </div>
        <div className="detail-item">
          <label>Remaining in Contract</label>
          <span style={{ color: payments.remaining > 0n ? "var(--yellow)" : "var(--text-muted)" }}>
            {ethers.formatEther(payments.remaining)} ETH
          </span>
        </div>
      </div>
    </div>
  );
}

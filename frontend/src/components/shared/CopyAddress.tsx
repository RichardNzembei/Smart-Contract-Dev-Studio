import { useState } from "react";

interface Props {
  address: string;
  truncate?: boolean;
}

export function CopyAddress({ address, truncate = true }: Props) {
  const [copied, setCopied] = useState(false);

  const display = truncate ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  return (
    <span className="copyable-address" onClick={handleCopy} title={`Click to copy: ${address}`} style={{ position: "relative" }}>
      {display}
      {copied && <span className="copy-tooltip">Copied!</span>}
    </span>
  );
}

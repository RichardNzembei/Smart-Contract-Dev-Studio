import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { DevStudioClient } from "./DevStudioClient.js";

/**
 * Demo script showcasing the DevStudio contract workflow.
 * Run against a local Hardhat node: npx hardhat node
 * Then: npx tsx src/demo.ts
 */
async function main() {
  console.log("=== DevStudio Demo ===\n");

  // NOTE: This demo requires:
  // 1. A running Hardhat node (npx hardhat node)
  // 2. A deployed DevStudio contract
  // 3. The contract address and ABI to be configured below

  // The actual demo flow would be:
  // 1. Register developer
  // 2. Create a project with ETH budget
  // 3. Add milestones
  // 4. Assign developer to project
  // 5. Developer submits milestones
  // 6. Studio approves milestones (auto-pays developer)
  // 7. Studio rates developer

  console.log("Demo workflow:");
  console.log("1. Studio registers a developer");
  console.log("2. Studio creates project with 1 ETH budget");
  console.log("3. Studio adds 2 milestones (0.5 ETH each)");
  console.log("4. Studio assigns developer to project");
  console.log("5. Developer submits milestone 1");
  console.log("6. Studio approves milestone 1 → 0.5 ETH paid");
  console.log("7. Developer submits milestone 2");
  console.log("8. Studio approves milestone 2 → 0.5 ETH paid");
  console.log("9. Project auto-completes");
  console.log("10. Studio rates developer 5/5");
  console.log(
    "\nTo run this demo end-to-end, deploy the contract and update this script with the contract address.",
  );
}

main().catch(console.error);

/**
 * Deploy DevStudio contract and seed with demo data.
 * Run: npx tsx scripts/seed.ts
 * Requires a running Hardhat node on http://127.0.0.1:8545
 */
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";

const RPC = "http://127.0.0.1:8545";
const artifact = JSON.parse(
  readFileSync("artifacts/contracts/DevStudio.sol/DevStudio.json", "utf-8")
);

// Hardhat default accounts
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0 — Studio
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1 — Alice
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2 — Bob
];

const provider = new ethers.JsonRpcProvider(RPC);

async function main() {
  // Use JsonRpcSigner (managed by the node, no local nonce cache issues)
  const studio = await provider.getSigner(0);
  const alice = await provider.getSigner(1);
  const bob = await provider.getSigner(2);

  console.log("Deploying DevStudio...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, studio);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const addr = await deployed.getAddress();
  console.log(`Contract: ${addr}\n`);

  const S = new ethers.Contract(addr, artifact.abi, studio);
  const A = new ethers.Contract(addr, artifact.abi, alice);
  const B = new ethers.Contract(addr, artifact.abi, bob);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 60); // 60 days
  const aliceAddr = await alice.getAddress();
  const bobAddr = await bob.getAddress();

  // ──── Register Developers ────
  console.log("Registering developers...");
  let tx = await A.registerDeveloper("Alice"); await tx.wait();
  tx = await B.registerDeveloper("Bob"); await tx.wait();
  console.log(`  Alice: ${aliceAddr}`);
  console.log(`  Bob:   ${bobAddr}`);

  // ──── Create rating history (quick completed projects) ────
  console.log("\nCreating rating history...");

  // Project #0 — quick job for Alice (completed, rated 5)
  tx = await S.createProject("Logo Design", "Company logo redesign", deadline, { value: ethers.parseEther("0.2") });
  await tx.wait();
  tx = await S.addMilestone(0, "Final Logo", ethers.parseEther("0.2"), deadline); await tx.wait();
  tx = await S.assignDeveloper(0, aliceAddr); await tx.wait();
  tx = await A.submitMilestone(0, 0); await tx.wait();
  tx = await S.approveMilestone(0, 0); await tx.wait();
  tx = await S.rateDeveloper(0, 5); await tx.wait();
  console.log("  Alice rated 5/5 on Logo Design");

  // Project #1 — quick job for Alice (completed, rated 4)
  tx = await S.createProject("API Docs", "REST API documentation", deadline, { value: ethers.parseEther("0.1") });
  await tx.wait();
  tx = await S.addMilestone(1, "Documentation", ethers.parseEther("0.1"), deadline); await tx.wait();
  tx = await S.assignDeveloper(1, aliceAddr); await tx.wait();
  tx = await A.submitMilestone(1, 0); await tx.wait();
  tx = await S.approveMilestone(1, 0); await tx.wait();
  tx = await S.rateDeveloper(1, 4); await tx.wait();
  console.log("  Alice rated 4/5 on API Docs");

  // Project #2 — quick job for Alice (completed, rated 3)
  tx = await S.createProject("Bug Fixes", "Critical bug fixes batch", deadline, { value: ethers.parseEther("0.1") });
  await tx.wait();
  tx = await S.addMilestone(2, "Fix All Bugs", ethers.parseEther("0.1"), deadline); await tx.wait();
  tx = await S.assignDeveloper(2, aliceAddr); await tx.wait();
  tx = await A.submitMilestone(2, 0); await tx.wait();
  tx = await S.approveMilestone(2, 0); await tx.wait();
  tx = await S.rateDeveloper(2, 3); await tx.wait();
  console.log("  Alice rated 3/5 on Bug Fixes");

  // Project #3 — quick job for Bob (completed, rated 5)
  tx = await S.createProject("Landing Page", "Marketing landing page", deadline, { value: ethers.parseEther("0.3") });
  await tx.wait();
  tx = await S.addMilestone(3, "Page Design", ethers.parseEther("0.3"), deadline); await tx.wait();
  tx = await S.assignDeveloper(3, bobAddr); await tx.wait();
  tx = await B.submitMilestone(3, 0); await tx.wait();
  tx = await S.approveMilestone(3, 0); await tx.wait();
  tx = await S.rateDeveloper(3, 5); await tx.wait();
  console.log("  Bob rated 5/5 on Landing Page");

  // Project #4 — quick job for Bob (completed, rated 5)
  tx = await S.createProject("CI/CD Pipeline", "GitHub Actions setup", deadline, { value: ethers.parseEther("0.2") });
  await tx.wait();
  tx = await S.addMilestone(4, "Pipeline Config", ethers.parseEther("0.2"), deadline); await tx.wait();
  tx = await S.assignDeveloper(4, bobAddr); await tx.wait();
  tx = await B.submitMilestone(4, 0); await tx.wait();
  tx = await S.approveMilestone(4, 0); await tx.wait();
  tx = await S.rateDeveloper(4, 5); await tx.wait();
  console.log("  Bob rated 5/5 on CI/CD Pipeline");

  // ──── Main Project #5 — Mobile Banking App (InProgress) ────
  console.log("\nCreating main projects...");

  tx = await S.createProject(
    "Mobile Banking App",
    "iOS and Android app with login, dashboard and transfers",
    deadline,
    { value: ethers.parseEther("2.0") }
  );
  await tx.wait();

  tx = await S.addMilestone(5, "UI Wireframes", ethers.parseEther("0.4"), deadline); await tx.wait();
  tx = await S.addMilestone(5, "Backend API", ethers.parseEther("0.6"), deadline); await tx.wait();
  tx = await S.addMilestone(5, "Payment Integration", ethers.parseEther("0.5"), deadline); await tx.wait();
  tx = await S.addMilestone(5, "Testing & Launch", ethers.parseEther("0.5"), deadline); await tx.wait();

  tx = await S.assignDeveloper(5, aliceAddr); await tx.wait();

  // Alice completes milestone #0
  tx = await A.submitMilestone(5, 0); await tx.wait();
  tx = await S.approveMilestone(5, 0); await tx.wait();

  console.log("  Mobile Banking App: 2 ETH, 4 milestones, Alice assigned, 1/4 approved");

  // ──── Main Project #6 — E-commerce Dashboard (Active, open) ────
  tx = await S.createProject(
    "E-commerce Dashboard",
    "Admin panel with analytics and inventory management",
    deadline,
    { value: ethers.parseEther("1.5") }
  );
  await tx.wait();

  tx = await S.addMilestone(6, "Dashboard Layout", ethers.parseEther("0.5"), deadline); await tx.wait();
  tx = await S.addMilestone(6, "Analytics Charts", ethers.parseEther("0.5"), deadline); await tx.wait();
  tx = await S.addMilestone(6, "Inventory Module", ethers.parseEther("0.5"), deadline); await tx.wait();

  tx = await S.assignDeveloper(6, bobAddr); await tx.wait();

  console.log("  E-commerce Dashboard: 1.5 ETH, 3 milestones, Bob assigned, 0/3 approved");

  // ──── Client Funding Demo ────
  console.log("\nClient funding demo...");
  const clientSigner = await provider.getSigner(3);
  const ClientContract = new ethers.Contract(addr, artifact.abi, clientSigner);
  const clientAddr = await clientSigner.getAddress();

  // Client funds the Mobile Banking App (project #5) with 0.5 ETH
  tx = await ClientContract.fundProject(5, { value: ethers.parseEther("0.5") }); await tx.wait();
  console.log(`  Client (${clientAddr.slice(0, 6)}...) funded Mobile Banking App with 0.5 ETH`);

  // Client funds E-commerce Dashboard (project #6) with 1.0 ETH
  tx = await ClientContract.fundProject(6, { value: ethers.parseEther("1.0") }); await tx.wait();
  console.log(`  Client funded E-commerce Dashboard with 1.0 ETH`);

  // ──── Print Summary ────
  const [aliceAvg, aliceCount] = await S.getDeveloperRating(aliceAddr);
  const [bobAvg, bobCount] = await S.getDeveloperRating(bobAddr);
  const projectCount = await S.projectCount();

  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  Contract: ${addr}`);
  console.log(`  Projects: ${projectCount}`);
  console.log(`  Alice: avg ${aliceAvg}/5, ${aliceCount} ratings, earned ${ethers.formatEther(ethers.parseEther("0.4") + ethers.parseEther("0.2") + ethers.parseEther("0.1") + ethers.parseEther("0.1"))} ETH`);
  console.log(`  Bob:   avg ${bobAvg}/5, ${bobCount} ratings, earned ${ethers.formatEther(ethers.parseEther("0.3") + ethers.parseEther("0.2"))} ETH`);
  console.log("═══════════════════════════════════════\n");

  // Write .env.local for frontend
  writeFileSync("frontend/.env.local", `VITE_CONTRACT_ADDRESS=${addr}\nVITE_RPC_URL=http://127.0.0.1:8545\n`);
  console.log("Wrote frontend/.env.local");
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});

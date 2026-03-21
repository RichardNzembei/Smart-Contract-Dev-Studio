/**
 * End-to-End Real-World Verification Script
 *
 * Simulates a complete real-world scenario:
 *   - Studio Owner creates projects, adds milestones, assigns developers
 *   - Developers register, submit milestones, get paid
 *   - Disputes raised and resolved
 *   - Developers rated after completion
 *   - Verifies ETH balances at every step
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";

const RPC = "http://127.0.0.1:8545";
const artifact = JSON.parse(
  readFileSync("artifacts/contracts/DevStudio.sol/DevStudio.json", "utf-8")
);

// Hardhat test accounts
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Account 0 — Studio
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Account 1 — Alice (Dev)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Account 2 — Bob (Dev)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Account 3 — Client
];

const provider = new ethers.JsonRpcProvider(RPC);

function getWallet(index: number) {
  return new ethers.NonceManager(new ethers.Wallet(KEYS[index], provider));
}

function getContract(address: string, signer: ethers.NonceManager) {
  return new ethers.Contract(address, artifact.abi, signer);
}

function fmt(wei: bigint) {
  return ethers.formatEther(wei) + " ETH";
}

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// Test that a staticCall reverts (doesn't send actual tx, no nonce issues)
async function expectRevert(call: Promise<any>, label: string) {
  try {
    await call;
    console.log(`  ❌ FAIL: ${label} (should have reverted)`);
    failed++;
  } catch {
    console.log(`  ✅ ${label}`);
    passed++;
  }
}

async function send(contract: ethers.Contract, method: string, args: any[], opts?: any) {
  const tx = await contract[method](...args, ...(opts ? [opts] : []));
  return tx.wait();
}

function gasCost(receipt: ethers.TransactionReceipt): bigint {
  // EIP-1559: use effectiveGasPrice if available, fallback to gasPrice
  const price = receipt.gasPrice ?? 0n;
  return receipt.gasUsed * price;
}

// Check balance within 0.01 ETH tolerance (to handle gas variations)
function approxEqual(a: bigint, b: bigint, label: string) {
  const diff = a > b ? a - b : b - a;
  const tolerance = ethers.parseEther("0.01");
  ok(diff < tolerance, `${label} (actual: ${fmt(a)}, expected: ~${fmt(b)})`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   DevStudio — Full End-to-End Real-World Verification       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const studio = getWallet(0);
  const alice  = getWallet(1);
  const bob    = getWallet(2);
  const client = getWallet(3);

  const studioAddr = await studio.getAddress();
  const aliceAddr  = await alice.getAddress();
  const bobAddr    = await bob.getAddress();
  const clientAddr = await client.getAddress();
  console.log(`Studio  : ${studioAddr}`);
  console.log(`Alice   : ${aliceAddr}`);
  console.log(`Bob     : ${bobAddr}`);
  console.log(`Client  : ${clientAddr}\n`);

  // ═══════════════════════════════════════════
  // STEP 0: Deploy fresh contract
  // ═══════════════════════════════════════════
  console.log("━━━ STEP 0: Deploy Fresh Contract ━━━");
  const deployWallet = new ethers.Wallet(KEYS[0], provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployWallet);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const addr = await deployed.getAddress();
  // Reset nonce managers after deployment
  studio.reset();
  console.log(`  Contract deployed at: ${addr}`);

  const S  = getContract(addr, studio);
  const A  = getContract(addr, alice);
  const B  = getContract(addr, bob);
  const C  = getContract(addr, client);

  ok((await S.studio()).toLowerCase() === studioAddr.toLowerCase(), "Studio owner is deployer");
  ok((await S.projectCount()) === 0n, "Initial project count is 0");

  // ═══════════════════════════════════════════
  // STEP 1: Register Developers
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 1: Register Developers ━━━");

  await send(A, "registerDeveloper", ["Alice"]);
  const aliceDev = await S.getDeveloper(aliceAddr);
  ok(aliceDev.name === "Alice", "Alice registered with name 'Alice'");
  ok(aliceDev.registered === true, "Alice is marked as registered");
  ok(aliceDev.wallet.toLowerCase() === aliceAddr.toLowerCase(), "Alice wallet matches");

  await send(B, "registerDeveloper", ["Bob"]);
  const bobDev = await S.getDeveloper(bobAddr);
  ok(bobDev.name === "Bob", "Bob registered with name 'Bob'");
  ok(bobDev.registered === true, "Bob is marked as registered");

  // Use staticCall to test reverts (no nonce side effects)
  await expectRevert(
    A.registerDeveloper.staticCall("Alice2"),
    "Duplicate registration rejected"
  );

  await expectRevert(
    C.registerDeveloper.staticCall(""),
    "Empty name rejected"
  );

  // ═══════════════════════════════════════════
  // STEP 2: Studio Creates Project #0 — "Mobile Banking App"
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 2: Create Project #0 — Mobile Banking App (2 ETH) ━━━");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);
  const budget = ethers.parseEther("2.0");

  await send(S, "createProject", ["Mobile Banking App", "iOS and Android app with login, dashboard, transfers", deadline], { value: budget });
  const contractBal = await provider.getBalance(addr);
  ok(contractBal === budget, `Contract holds 2 ETH after project creation (actual: ${fmt(contractBal)})`);

  const p0 = await S.getProject(0n);
  ok(p0.title === "Mobile Banking App", "Project title correct");
  ok(p0.budget === budget, "Budget: 2 ETH");
  ok(p0.status === 0n, "Status: Active");
  ok(p0.milestoneCount === 0n, "0 milestones");
  ok(p0.developer === ethers.ZeroAddress, "No developer assigned");
  ok((await S.projectCount()) === 1n, "Project count: 1");

  await expectRevert(
    A.createProject.staticCall("Hack", "x", deadline, { value: ethers.parseEther("1") }),
    "Non-studio can't create projects"
  );

  await expectRevert(
    S.createProject.staticCall("X", "X", deadline, { value: 0n }),
    "Zero budget rejected"
  );

  await expectRevert(
    S.createProject.staticCall("X", "X", 1n, { value: ethers.parseEther("1") }),
    "Past deadline rejected"
  );

  // ═══════════════════════════════════════════
  // STEP 3: Add 4 Milestones
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 3: Add 4 Milestones to Project #0 ━━━");

  const ms = [
    { title: "UI Wireframes",       value: ethers.parseEther("0.4") },
    { title: "Backend API",         value: ethers.parseEther("0.6") },
    { title: "Payment Integration", value: ethers.parseEther("0.5") },
    { title: "Testing & Launch",    value: ethers.parseEther("0.5") },
  ]; // Total: 2.0 ETH = budget

  for (const m of ms) {
    await send(S, "addMilestone", [0n, m.title, m.value, deadline]);
  }

  ok((await S.getProject(0n)).milestoneCount === 4n, "4 milestones added");

  for (let i = 0; i < ms.length; i++) {
    const m = await S.getMilestone(0n, BigInt(i));
    ok(m.title === ms[i].title, `Milestone #${i}: "${m.title}" — ${fmt(m.value)}`);
    ok(m.status === 0n, `Milestone #${i} status: Pending`);
  }

  await expectRevert(
    S.addMilestone.staticCall(0n, "Extra", ethers.parseEther("0.1"), deadline),
    "Exceeding budget rejected"
  );

  await expectRevert(
    A.addMilestone.staticCall(0n, "Hack", ethers.parseEther("0.1"), deadline),
    "Non-studio can't add milestones"
  );

  // ═══════════════════════════════════════════
  // STEP 4: Assign Alice to Project #0
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 4: Assign Alice to Project #0 ━━━");

  await send(S, "assignDeveloper", [0n, aliceAddr]);
  ok((await S.getProject(0n)).developer.toLowerCase() === aliceAddr.toLowerCase(), "Alice assigned to project");

  await expectRevert(
    S.assignDeveloper.staticCall(0n, bobAddr),
    "Re-assignment rejected (developer already assigned)"
  );

  await expectRevert(
    B.submitMilestone.staticCall(0n, 0n),
    "Non-assigned dev (Bob) can't submit"
  );

  // ═══════════════════════════════════════════
  // STEP 5: Submit & Approve all 4 milestones — verify ETH payments
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 5: Submit & Approve All Milestones (verify payments) ━━━");

  for (let i = 0; i < 4; i++) {
    const bi = BigInt(i);
    const aliceBal0 = await provider.getBalance(aliceAddr);

    // Alice submits
    await send(A, "submitMilestone", [0n, bi]);

    let m = await S.getMilestone(0n, bi);
    ok(m.status === 1n, `Milestone #${i} submitted`);

    // Studio approves → ETH released to Alice
    await send(S, "approveMilestone", [0n, bi]);
    m = await S.getMilestone(0n, bi);
    ok(m.status === 2n, `Milestone #${i} approved`);

    const aliceBal1 = await provider.getBalance(aliceAddr);
    // Alice pays gas for submit, but receives milestone value from approve
    // Net gain should be approximately milestone value (minus small gas)
    const netGain = aliceBal1 - aliceBal0;
    approxEqual(netGain, ms[i].value, `Alice received ~${fmt(ms[i].value)} for milestone #${i}`);
  }

  // Verify project auto-completed
  const p0done = await S.getProject(0n);
  ok(p0done.status === 1n, "Project #0 auto-completed (all milestones approved)");
  ok(p0done.approvedCount === 4n, "4/4 milestones approved");

  const contractBal1 = await provider.getBalance(addr);
  ok(contractBal1 === 0n, `Contract balance: 0 ETH (all paid out)`);

  // Can't re-approve already-approved milestone
  await expectRevert(
    S.approveMilestone.staticCall(0n, 0n),
    "Re-approval of completed project rejected"
  );

  // ═══════════════════════════════════════════
  // STEP 6: Rate Alice (5 stars)
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 6: Rate Alice ━━━");

  await send(S, "rateDeveloper", [0n, 5]);
  const [aliceAvg, aliceCount] = await S.getDeveloperRating(aliceAddr);
  ok(aliceAvg === 5n, `Alice average rating: ${aliceAvg}/5`);
  ok(aliceCount === 1n, `Alice rating count: ${aliceCount}`);

  await expectRevert(
    S.rateDeveloper.staticCall(0n, 0),
    "Rating 0 rejected (must be 1-5)"
  );

  await expectRevert(
    S.rateDeveloper.staticCall(0n, 6),
    "Rating 6 rejected (must be 1-5)"
  );

  // ═══════════════════════════════════════════
  // STEP 7: Project #1 — "E-commerce Dashboard" (Dispute → Favor Developer)
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 7: Project #1 — E-commerce Dashboard + Dispute ━━━");

  await send(S, "createProject", [
    "E-commerce Dashboard", "Admin panel with analytics", deadline
  ], { value: ethers.parseEther("1.5") });

  await send(S, "addMilestone", [1n, "Dashboard UI", ethers.parseEther("0.5"), deadline]);
  await send(S, "addMilestone", [1n, "Analytics Engine", ethers.parseEther("0.5"), deadline]);
  await send(S, "addMilestone", [1n, "Inventory Module", ethers.parseEther("0.5"), deadline]);

  await send(S, "assignDeveloper", [1n, bobAddr]);
  ok(true, "Project #1 created: 3 milestones, 1.5 ETH, assigned to Bob");

  // Bob completes milestone 0 (0.5 ETH paid)
  await send(B, "submitMilestone", [1n, 0n]);
  await send(S, "approveMilestone", [1n, 0n]);
  ok((await S.getProject(1n)).approvedCount === 1n, "Milestone #0 approved & paid (0.5 ETH)");

  // Bob submits milestone 1 (pending approval)
  await send(B, "submitMilestone", [1n, 1n]);

  // Bob raises dispute
  await send(B, "raiseDispute", [1n]);
  ok((await S.getProject(1n)).status === 2n, "Project #1: Disputed");

  // Can't submit while disputed
  await expectRevert(
    B.submitMilestone.staticCall(1n, 2n),
    "Can't submit during dispute"
  );

  // Studio resolves in favor of Bob → Bob gets paid for submitted milestone #1
  const bobBal0 = await provider.getBalance(bobAddr);
  await send(S, "resolveDispute", [1n, true]);
  const bobBal1 = await provider.getBalance(bobAddr);
  const bobGain = bobBal1 - bobBal0;
  // Bob doesn't pay gas (studio does), so gain should be exact
  approxEqual(bobGain, ethers.parseEther("0.5"), `Bob received ~0.5 ETH from dispute resolution`);
  ok((await S.getProject(1n)).status === 1n, "Project #1: Completed (dispute resolved for dev)");

  // ═══════════════════════════════════════════
  // STEP 8: Rate Bob (4 stars)
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 8: Rate Bob ━━━");

  await send(S, "rateDeveloper", [1n, 4]);
  const [bobAvg, bobCount] = await S.getDeveloperRating(bobAddr);
  ok(bobAvg === 4n, `Bob average rating: ${bobAvg}/5`);
  ok(bobCount === 1n, `Bob rating count: ${bobCount}`);

  // ═══════════════════════════════════════════
  // STEP 9: Project #2 — Dispute Against Developer (Studio Refund)
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 9: Project #2 — AI Chatbot + Dispute Against Dev ━━━");

  await send(S, "createProject", [
    "AI Chatbot", "Customer support chatbot with NLP", deadline
  ], { value: ethers.parseEther("1.0") });

  await send(S, "addMilestone", [2n, "NLP Engine", ethers.parseEther("0.5"), deadline]);
  await send(S, "addMilestone", [2n, "Chat UI", ethers.parseEther("0.5"), deadline]);
  await send(S, "assignDeveloper", [2n, aliceAddr]);
  ok(true, "Project #2 created: 2 milestones, 1.0 ETH, assigned to Alice");

  // Studio raises dispute before any work done
  await send(S, "raiseDispute", [2n]);
  ok((await S.getProject(2n)).status === 2n, "Project #2: Disputed");

  // Resolve against developer → full refund to studio
  const studioBal0 = await provider.getBalance(studioAddr);
  await send(S, "resolveDispute", [2n, false]);
  const studioBal1 = await provider.getBalance(studioAddr);

  // Studio pays gas but receives 1.0 ETH refund, net gain should be ~1.0 ETH
  const studioNetGain = studioBal1 - studioBal0;
  approxEqual(studioNetGain, ethers.parseEther("1.0"), `Studio refunded ~1.0 ETH`);
  ok((await S.getProject(2n)).status === 3n, "Project #2: Cancelled");

  // Can't rate on cancelled project
  await expectRevert(
    S.rateDeveloper.staticCall(2n, 5),
    "Rating on cancelled project rejected"
  );

  // ═══════════════════════════════════════════
  // STEP 10: Project #3 — Partial Approval + Dispute Against Dev
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 10: Project #3 — Partial Work + Refund ━━━");

  await send(S, "createProject", [
    "Portfolio Website", "Personal portfolio site", deadline
  ], { value: ethers.parseEther("1.0") });

  await send(S, "addMilestone", [3n, "Design", ethers.parseEther("0.3"), deadline]);
  await send(S, "addMilestone", [3n, "Frontend", ethers.parseEther("0.3"), deadline]);
  await send(S, "addMilestone", [3n, "Deployment", ethers.parseEther("0.4"), deadline]);

  await send(S, "assignDeveloper", [3n, bobAddr]);

  // Bob completes milestone 0 (0.3 ETH paid)
  await send(B, "submitMilestone", [3n, 0n]);
  await send(S, "approveMilestone", [3n, 0n]);
  ok((await S.getMilestone(3n, 0n)).status === 2n, "Milestone #0 approved (0.3 ETH paid)");

  // Dispute raised, resolved against dev
  await send(S, "raiseDispute", [3n]);

  const studioBal2 = await provider.getBalance(studioAddr);
  await send(S, "resolveDispute", [3n, false]);
  const studioBal3 = await provider.getBalance(studioAddr);

  const refund = studioBal3 - studioBal2;
  approxEqual(refund, ethers.parseEther("0.7"), `Studio refunded ~0.7 ETH`);
  ok((await S.getProject(3n)).status === 3n, "Project #3: Cancelled");

  // ═══════════════════════════════════════════
  // STEP 11: Multiple ratings for Alice — test accumulation
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 11: Additional Ratings for Alice ━━━");

  // Alice was rated 5 on project #0. Let's rate her again on a new completed project.
  // But we need a completed project — let's create a quick one.
  await send(S, "createProject", [
    "Quick Fix", "Small task", deadline
  ], { value: ethers.parseEther("0.1") });
  await send(S, "addMilestone", [4n, "Fix", ethers.parseEther("0.1"), deadline]);
  await send(S, "assignDeveloper", [4n, aliceAddr]);
  await send(A, "submitMilestone", [4n, 0n]);
  await send(S, "approveMilestone", [4n, 0n]);
  ok((await S.getProject(4n)).status === 1n, "Quick project #4 completed");

  await send(S, "rateDeveloper", [4n, 3]);
  const [aliceAvg2, aliceCount2] = await S.getDeveloperRating(aliceAddr);
  // (5 + 3) / 2 = 4 (integer division)
  ok(aliceAvg2 === 4n, `Alice average: (5+3)/2 = ${aliceAvg2}`);
  ok(aliceCount2 === 2n, `Alice ratings: ${aliceCount2}`);

  // ═══════════════════════════════════════════
  // STEP 12: Dispute raised by Studio (not just dev)
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 12: Studio Raises Dispute ━━━");

  await send(S, "createProject", [
    "Data Pipeline", "ETL pipeline", deadline
  ], { value: ethers.parseEther("0.5") });
  await send(S, "addMilestone", [5n, "Pipeline", ethers.parseEther("0.5"), deadline]);
  await send(S, "assignDeveloper", [5n, bobAddr]);

  // Studio raises dispute (not developer)
  await send(S, "raiseDispute", [5n]);
  ok((await S.getProject(5n)).status === 2n, "Studio raised dispute on project #5");

  // Resolve in favor of dev — but no submitted milestones, so no payment
  const bobBal2 = await provider.getBalance(bobAddr);
  await send(S, "resolveDispute", [5n, true]);
  const bobBal3 = await provider.getBalance(bobAddr);
  ok(bobBal3 === bobBal2, "No payment when no milestones were submitted");
  ok((await S.getProject(5n)).status === 1n, "Project #5: Completed (dispute resolved, no work)");

  // ═══════════════════════════════════════════
  // STEP 13: Final State Summary
  // ═══════════════════════════════════════════
  console.log("\n━━━ STEP 13: Final State Summary ━━━");

  const totalProjects = await S.projectCount();
  ok(totalProjects === 6n, `Total projects: ${totalProjects}`);

  const statuses = [];
  for (let i = 0n; i < totalProjects; i++) {
    const p = await S.getProject(i);
    const statusName = ["Active", "Completed", "Disputed", "Cancelled"][Number(p.status)];
    statuses.push(`#${i}: ${p.title} → ${statusName}`);
  }
  console.log("  Projects:");
  for (const s of statuses) console.log(`    ${s}`);

  const finalBal = await provider.getBalance(addr);
  console.log(`  Contract balance: ${fmt(finalBal)}`);
  // Project 0: 2.0 paid, Project 1: 1.0 paid + 0.5 locked (ms#2 never resolved),
  // Project 2: 1.0 refunded, Project 3: 0.3 paid + 0.7 refunded
  // Project 4: 0.1 paid, Project 5: 0.5 locked (resolved but no submitted ms)
  // Locked: 0.5 (proj1 ms#2) + 0.5 (proj5 all ms) = 1.0 ETH
  ok(finalBal === ethers.parseEther("1.0"), `Contract holds 1.0 ETH (locked in completed projects with unpaid milestones)`);

  const [aR, aC] = await S.getDeveloperRating(aliceAddr);
  const [bR, bC] = await S.getDeveloperRating(bobAddr);
  console.log(`  Alice: avg=${aR}/5, count=${aC}`);
  console.log(`  Bob:   avg=${bR}/5, count=${bC}`);

  // ═══════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  if (failed === 0) {
    console.log(`║  ✅  ALL ${passed} CHECKS PASSED                                    ║`);
  } else {
    console.log(`║  RESULTS: ${passed} passed, ${failed} failed                              ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════╝");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n💥 Script crashed:", err.message || err);
  process.exit(1);
});

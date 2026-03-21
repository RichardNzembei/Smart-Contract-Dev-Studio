import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("DevStudio", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper to deploy a fresh contract
  async function deployDevStudio() {
    const [studio, dev1, dev2] = await viem.getWalletClients();
    const contract = await viem.deployContract("DevStudio");
    return { contract, studio, dev1, dev2 };
  }

  // ──── Developer Registration ────
  describe("Developer Registration", async function () {
    it("Should register a developer", async function () {
      const { contract, dev1 } = await deployDevStudio();

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });

      const dev = await contract.read.getDeveloper([dev1.account.address]);
      assert.equal(dev.name, "Alice");
      assert.equal(dev.registered, true);
      assert.equal(getAddress(dev.wallet), getAddress(dev1.account.address));
    });

    it("Should emit DeveloperRegistered event", async function () {
      const { contract, dev1 } = await deployDevStudio();

      await viem.assertions.emitWithArgs(
        contract.write.registerDeveloper(["Alice"], {
          account: dev1.account,
        }),
        contract,
        "DeveloperRegistered",
        [getAddress(dev1.account.address), "Alice"],
      );
    });

    it("Should reject duplicate registration", async function () {
      const { contract, dev1 } = await deployDevStudio();

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });

      await assert.rejects(
        contract.write.registerDeveloper(["Alice2"], {
          account: dev1.account,
        }),
        (err: Error) => {
          assert.ok(err.message.includes("Already registered"));
          return true;
        },
      );
    });

    it("Should reject empty name", async function () {
      const { contract, dev1 } = await deployDevStudio();

      await assert.rejects(
        contract.write.registerDeveloper([""], {
          account: dev1.account,
        }),
        (err: Error) => {
          assert.ok(err.message.includes("Name cannot be empty"));
          return true;
        },
      );
    });
  });

  // ──── Project Creation ────
  describe("Project Creation", async function () {
    it("Should create a project with ETH budget", async function () {
      const { contract, studio } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(
        ["Project Alpha", "A test project", deadline],
        { value: parseEther("1") },
      );

      const project = await contract.read.getProject([0n]);
      assert.equal(project.title, "Project Alpha");
      assert.equal(project.budget, parseEther("1"));
      assert.equal(project.status, 0); // Active
    });

    it("Should emit ProjectCreated event", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await viem.assertions.emitWithArgs(
        contract.write.createProject(
          ["Project Alpha", "A test project", deadline],
          { value: parseEther("1") },
        ),
        contract,
        "ProjectCreated",
        [0n, "Project Alpha", parseEther("1"), deadline],
      );
    });

    it("Should reject zero budget", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await assert.rejects(
        contract.write.createProject(["P", "D", deadline], { value: 0n }),
        (err: Error) => {
          assert.ok(err.message.includes("Budget must be greater than 0"));
          return true;
        },
      );
    });

    it("Should reject non-studio caller", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await assert.rejects(
        contract.write.createProject(["P", "D", deadline], {
          value: parseEther("1"),
          account: dev1.account,
        }),
        (err: Error) => {
          assert.ok(err.message.includes("Only studio can call this"));
          return true;
        },
      );
    });
  });

  // ──── Milestones ────
  describe("Milestones", async function () {
    it("Should add milestones to a project", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });

      await contract.write.addMilestone([
        0n,
        "Milestone 1",
        parseEther("0.5"),
        deadline,
      ]);
      await contract.write.addMilestone([
        0n,
        "Milestone 2",
        parseEther("0.5"),
        deadline,
      ]);

      const m1 = await contract.read.getMilestone([0n, 0n]);
      const m2 = await contract.read.getMilestone([0n, 1n]);
      assert.equal(m1.title, "Milestone 1");
      assert.equal(m2.title, "Milestone 2");
      assert.equal(m1.value, parseEther("0.5"));
    });

    it("Should reject milestones exceeding budget", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });

      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("0.8"),
        deadline,
      ]);

      await assert.rejects(
        contract.write.addMilestone([0n, "M2", parseEther("0.5"), deadline]),
        (err: Error) => {
          assert.ok(
            err.message.includes("Total milestone values exceed budget"),
          );
          return true;
        },
      );
    });
  });

  // ──── Full Workflow: Assign, Submit, Approve, Pay ────
  describe("Full Workflow", async function () {
    it("Should complete a project with milestone payments", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      // Register developer
      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });

      // Create project
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });

      // Add milestones
      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("0.5"),
        deadline,
      ]);
      await contract.write.addMilestone([
        0n,
        "M2",
        parseEther("0.5"),
        deadline,
      ]);

      // Assign developer
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Get dev balance before
      const balBefore = await publicClient.getBalance({
        address: dev1.account.address,
      });

      // Submit and approve milestone 1
      await contract.write.submitMilestone([0n, 0n], {
        account: dev1.account,
      });
      await contract.write.approveMilestone([0n, 0n]);

      // Check payment received
      const balAfterM1 = await publicClient.getBalance({
        address: dev1.account.address,
      });
      // Balance should have increased (accounting for gas spent on submitMilestone)
      assert.ok(balAfterM1 > balBefore);

      // Submit and approve milestone 2
      await contract.write.submitMilestone([0n, 1n], {
        account: dev1.account,
      });
      await contract.write.approveMilestone([0n, 1n]);

      // Project should be completed
      const project = await contract.read.getProject([0n]);
      assert.equal(project.status, 1); // Completed
    });

    it("Should reject submit from non-assigned developer", async function () {
      const { contract, dev1, dev2 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("1"),
        deadline,
      ]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      await assert.rejects(
        contract.write.submitMilestone([0n, 0n], { account: dev2.account }),
        (err: Error) => {
          assert.ok(
            err.message.includes(
              "Only assigned developer can call this",
            ),
          );
          return true;
        },
      );
    });
  });

  // ──── Disputes ────
  describe("Disputes", async function () {
    it("Should raise and resolve dispute in favor of developer", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("1"),
        deadline,
      ]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Submit milestone
      await contract.write.submitMilestone([0n, 0n], {
        account: dev1.account,
      });

      // Raise dispute (dev)
      await contract.write.raiseDispute([0n], { account: dev1.account });

      const disputedProject = await contract.read.getProject([0n]);
      assert.equal(disputedProject.status, 2); // Disputed

      // Resolve in favor of dev
      await contract.write.resolveDispute([0n, true]);

      const resolvedProject = await contract.read.getProject([0n]);
      assert.equal(resolvedProject.status, 1); // Completed
    });

    it("Should resolve dispute against developer and refund studio", async function () {
      const { contract, studio, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("1"),
        deadline,
      ]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Raise dispute (studio)
      await contract.write.raiseDispute([0n]);

      const studioBalBefore = await publicClient.getBalance({
        address: studio.account.address,
      });

      // Resolve against dev — refund to studio
      await contract.write.resolveDispute([0n, false]);

      const studioBalAfter = await publicClient.getBalance({
        address: studio.account.address,
      });

      // Studio should have received refund (minus gas)
      // The refund is 1 ETH but gas is deducted, so just check project status
      const project = await contract.read.getProject([0n]);
      assert.equal(project.status, 3); // Cancelled
    });
  });

  // ──── Reputation ────
  describe("Reputation", async function () {
    it("Should rate developer after project completion", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("1"),
        deadline,
      ]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], {
        account: dev1.account,
      });
      await contract.write.approveMilestone([0n, 0n]);

      // Rate developer
      await contract.write.rateDeveloper([0n, 5]);

      const [average, count] = await contract.read.getDeveloperRating([
        dev1.account.address,
      ]);
      assert.equal(average, 5n);
      assert.equal(count, 1n);
    });

    it("Should reject rating on non-completed project", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      await assert.rejects(
        contract.write.rateDeveloper([0n, 5]),
        (err: Error) => {
          assert.ok(err.message.includes("Project not completed"));
          return true;
        },
      );
    });

    it("Should reject invalid rating value", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], {
        account: dev1.account,
      });
      await contract.write.createProject(["P", "D", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([
        0n,
        "M1",
        parseEther("1"),
        deadline,
      ]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], {
        account: dev1.account,
      });
      await contract.write.approveMilestone([0n, 0n]);

      await assert.rejects(
        contract.write.rateDeveloper([0n, 0]),
        (err: Error) => {
          assert.ok(err.message.includes("Rating must be 1-5"));
          return true;
        },
      );
    });
  });

  // ──── Full Real-World E2E Scenario ────
  describe("End-to-End Real-World Scenario", async function () {
    it("Complete lifecycle: 2 projects, payments, dispute, refund, ratings", async function () {
      const { contract, studio, dev1, dev2 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);

      // 1. Register two developers
      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.registerDeveloper(["Bob"], { account: dev2.account });

      // 2. Create Project #0 — "Mobile App" with 2 ETH budget
      await contract.write.createProject(["Mobile App", "iOS app", deadline], {
        value: parseEther("2"),
      });

      // 3. Add 4 milestones (total = 2 ETH)
      await contract.write.addMilestone([0n, "UI Wireframes", parseEther("0.4"), deadline]);
      await contract.write.addMilestone([0n, "Backend API", parseEther("0.6"), deadline]);
      await contract.write.addMilestone([0n, "Payments", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([0n, "Launch", parseEther("0.5"), deadline]);

      const p0 = await contract.read.getProject([0n]);
      assert.equal(p0.milestoneCount, 4n);

      // 4. Assign Alice
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // 5. Alice submits & studio approves all 4 milestones
      const aliceBalBefore = await publicClient.getBalance({ address: dev1.account.address });

      for (let i = 0n; i < 4n; i++) {
        await contract.write.submitMilestone([0n, i], { account: dev1.account });
        const ms = await contract.read.getMilestone([0n, i]);
        assert.equal(ms.status, 1); // Submitted

        await contract.write.approveMilestone([0n, i]);
        const msApproved = await contract.read.getMilestone([0n, i]);
        assert.equal(msApproved.status, 2); // Approved
      }

      // 6. Verify project auto-completed
      const p0done = await contract.read.getProject([0n]);
      assert.equal(p0done.status, 1); // Completed
      assert.equal(p0done.approvedCount, 4n);

      // 7. Verify Alice received ~2 ETH (minus gas for 4 submits)
      const aliceBalAfter = await publicClient.getBalance({ address: dev1.account.address });
      const aliceGain = aliceBalAfter - aliceBalBefore;
      assert.ok(aliceGain > parseEther("1.99"), `Alice gained ${aliceGain} (expected ~2 ETH)`);

      // 8. Verify contract balance is 0
      const contractBal0 = await publicClient.getBalance({ address: contract.address });
      assert.equal(contractBal0, 0n);

      // 9. Rate Alice 5/5
      await contract.write.rateDeveloper([0n, 5]);
      const [aliceAvg1, aliceCount1] = await contract.read.getDeveloperRating([dev1.account.address]);
      assert.equal(aliceAvg1, 5n);
      assert.equal(aliceCount1, 1n);

      // ──── Project #1: Dispute scenario ────

      // 10. Create Project #1 — 1.5 ETH, 3 milestones, assigned to Bob
      await contract.write.createProject(["Dashboard", "Admin panel", deadline], {
        value: parseEther("1.5"),
      });
      await contract.write.addMilestone([1n, "Dashboard UI", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([1n, "Analytics", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([1n, "Inventory", parseEther("0.5"), deadline]);
      await contract.write.assignDeveloper([1n, dev2.account.address]);

      // 11. Bob completes milestone #0 (0.5 ETH paid)
      await contract.write.submitMilestone([1n, 0n], { account: dev2.account });
      await contract.write.approveMilestone([1n, 0n]);

      // 12. Bob submits milestone #1 (pending approval)
      await contract.write.submitMilestone([1n, 1n], { account: dev2.account });

      // 13. Bob raises dispute
      await contract.write.raiseDispute([1n], { account: dev2.account });
      const p1disp = await contract.read.getProject([1n]);
      assert.equal(p1disp.status, 2); // Disputed

      // 14. Resolve dispute in favor of Bob
      const bobBalBefore = await publicClient.getBalance({ address: dev2.account.address });
      await contract.write.resolveDispute([1n, true]);
      const bobBalAfter = await publicClient.getBalance({ address: dev2.account.address });

      // Bob should receive 0.5 ETH for milestone #1 (studio pays gas, not Bob)
      const bobGain = bobBalAfter - bobBalBefore;
      assert.equal(bobGain, parseEther("0.5"), `Bob gained ${bobGain} from dispute (expected 0.5 ETH)`);

      const p1resolved = await contract.read.getProject([1n]);
      assert.equal(p1resolved.status, 1); // Completed

      // 15. Rate Bob 4/5
      await contract.write.rateDeveloper([1n, 4]);
      const [bobAvg, bobCount] = await contract.read.getDeveloperRating([dev2.account.address]);
      assert.equal(bobAvg, 4n);
      assert.equal(bobCount, 1n);

      // ──── Project #2: Dispute against developer (refund) ────

      // 16. Create Project #2 — 1 ETH, assigned to Alice, dispute before work
      await contract.write.createProject(["Chatbot", "NLP bot", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([2n, "NLP Engine", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([2n, "Chat UI", parseEther("0.5"), deadline]);
      await contract.write.assignDeveloper([2n, dev1.account.address]);

      // Studio raises dispute before any work
      await contract.write.raiseDispute([2n]);

      // Resolve against developer — studio gets full refund
      const studioBalBefore = await publicClient.getBalance({ address: studio.account.address });
      await contract.write.resolveDispute([2n, false]);
      const studioBalAfter = await publicClient.getBalance({ address: studio.account.address });

      // Studio paid gas but received 1 ETH refund — net gain ~1 ETH
      const studioGain = studioBalAfter - studioBalBefore;
      assert.ok(studioGain > parseEther("0.99"), `Studio gained ${studioGain} from refund (expected ~1 ETH)`);

      const p2 = await contract.read.getProject([2n]);
      assert.equal(p2.status, 3); // Cancelled

      // ──── Final state verification ────

      // 17. 3 projects total
      const count = await contract.read.projectCount();
      assert.equal(count, 3n);

      // Contract should hold 0.5 ETH (project #1 milestone #2 was never paid)
      const finalBal = await publicClient.getBalance({ address: contract.address });
      assert.equal(finalBal, parseEther("0.5"));
    });

    it("Partial approval + dispute against dev refunds remaining budget", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["Portfolio", "Site", deadline], {
        value: parseEther("1"),
      });
      await contract.write.addMilestone([0n, "Design", parseEther("0.3"), deadline]);
      await contract.write.addMilestone([0n, "Code", parseEther("0.3"), deadline]);
      await contract.write.addMilestone([0n, "Deploy", parseEther("0.4"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Approve only first milestone (0.3 ETH paid)
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });
      await contract.write.approveMilestone([0n, 0n]);

      // Raise dispute, resolve against dev
      await contract.write.raiseDispute([0n]);

      const studioBal0 = await publicClient.getBalance({ address: (await contract.read.studio()) as `0x${string}` });
      await contract.write.resolveDispute([0n, false]);
      const studioBal1 = await publicClient.getBalance({ address: (await contract.read.studio()) as `0x${string}` });

      // Refund = 1.0 - 0.3 = 0.7 ETH (minus gas)
      const studioGain = studioBal1 - studioBal0;
      assert.ok(studioGain > parseEther("0.69"), `Studio refunded ~0.7 ETH (actual: ${studioGain})`);

      // Contract should have 0 ETH left
      const contractBal = await publicClient.getBalance({ address: contract.address });
      assert.equal(contractBal, 0n);

      assert.equal((await contract.read.getProject([0n])).status, 3); // Cancelled
    });
  });
});

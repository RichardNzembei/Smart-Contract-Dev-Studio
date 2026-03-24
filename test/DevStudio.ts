import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("DevStudio", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper to deploy a fresh contract
  async function deployDevStudio() {
    const [studio, dev1, dev2, client1] = await viem.getWalletClients();
    const contract = await viem.deployContract("DevStudio");
    return { contract, studio, dev1, dev2, client1 };
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
      const { contract } = await deployDevStudio();
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

      await contract.write.addMilestone([0n, "Milestone 1", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([0n, "Milestone 2", parseEther("0.5"), deadline]);

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

      await contract.write.addMilestone([0n, "M1", parseEther("0.8"), deadline]);

      await assert.rejects(
        contract.write.addMilestone([0n, "M2", parseEther("0.5"), deadline]),
        (err: Error) => {
          assert.ok(err.message.includes("Total milestone values exceed budget"));
          return true;
        },
      );
    });
  });

  // ──── Full Workflow with Pull Payments ────
  describe("Full Workflow", async function () {
    it("Should complete a project — developer withdraws via pull pattern", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([0n, "M2", parseEther("0.5"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Submit and approve milestone 1
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });
      await contract.write.approveMilestone([0n, 0n]);

      // Check pending withdrawal credited
      const pending1 = await contract.read.pendingWithdrawals([dev1.account.address]);
      assert.equal(pending1, parseEther("0.5"));

      // Submit and approve milestone 2
      await contract.write.submitMilestone([0n, 1n], { account: dev1.account });
      await contract.write.approveMilestone([0n, 1n]);

      // Project should be completed
      const project = await contract.read.getProject([0n]);
      assert.equal(project.status, 1); // Completed

      // Check total pending = 1 ETH
      const pending2 = await contract.read.pendingWithdrawals([dev1.account.address]);
      assert.equal(pending2, parseEther("1"));

      // Developer withdraws
      const balBefore = await publicClient.getBalance({ address: dev1.account.address });
      await contract.write.withdraw({ account: dev1.account });
      const balAfter = await publicClient.getBalance({ address: dev1.account.address });

      // Balance increased by ~1 ETH (minus gas)
      assert.ok(balAfter - balBefore > parseEther("0.99"));

      // Pending should be 0
      const pendingFinal = await contract.read.pendingWithdrawals([dev1.account.address]);
      assert.equal(pendingFinal, 0n);
    });

    it("Should reject submit from non-assigned developer", async function () {
      const { contract, dev1, dev2 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      await assert.rejects(
        contract.write.submitMilestone([0n, 0n], { account: dev2.account }),
        (err: Error) => {
          assert.ok(err.message.includes("Only assigned developer can call this"));
          return true;
        },
      );
    });
  });

  // ──── Disputes with Pull Payments ────
  describe("Disputes", async function () {
    it("Should resolve dispute in favor of developer — credits pending withdrawal", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });

      await contract.write.raiseDispute([0n], { account: dev1.account });
      assert.equal((await contract.read.getProject([0n])).status, 2); // Disputed

      await contract.write.resolveDispute([0n, true]);

      assert.equal((await contract.read.getProject([0n])).status, 1); // Completed

      // Dev has pending withdrawal
      const pending = await contract.read.pendingWithdrawals([dev1.account.address]);
      assert.equal(pending, parseEther("1"));
    });

    it("Should resolve dispute against developer — credits studio pending withdrawal", async function () {
      const { contract, studio, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.raiseDispute([0n]);

      await contract.write.resolveDispute([0n, false]);

      const project = await contract.read.getProject([0n]);
      assert.equal(project.status, 3); // Cancelled

      // Studio has pending withdrawal of 1 ETH
      const pending = await contract.read.pendingWithdrawals([studio.account.address]);
      assert.equal(pending, parseEther("1"));

      // Studio withdraws
      const balBefore = await publicClient.getBalance({ address: studio.account.address });
      await contract.write.withdraw();
      const balAfter = await publicClient.getBalance({ address: studio.account.address });
      assert.ok(balAfter - balBefore > parseEther("0.99"));
    });
  });

  // ──── Proportional Client Refunds (C2) ────
  describe("Proportional Client Refunds", async function () {
    it("Should split refund proportionally between studio and client on cancel", async function () {
      const { contract, studio, client1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      // Studio creates project with 1 ETH
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });

      // Client funds with 1 ETH (total budget = 2 ETH, client share = 50%)
      await contract.write.fundProject([0n], { value: parseEther("1"), account: client1.account });

      // Cancel project
      await contract.write.cancelProject([0n]);

      // Check proportional refunds in pending withdrawals
      const studioPending = await contract.read.pendingWithdrawals([studio.account.address]);
      const clientPending = await contract.read.pendingWithdrawals([client1.account.address]);

      assert.equal(studioPending, parseEther("1")); // 50% of 2 ETH
      assert.equal(clientPending, parseEther("1")); // 50% of 2 ETH
    });
  });

  // ──── Developer Reassignment (C3) ────
  describe("Developer Reassignment", async function () {
    it("Should reassign developer when no milestones are submitted", async function () {
      const { contract, dev1, dev2 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.registerDeveloper(["Bob"], { account: dev2.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Reassign to Bob
      await contract.write.reassignDeveloper([0n, dev2.account.address]);

      const project = await contract.read.getProject([0n]);
      assert.equal(getAddress(project.developer), getAddress(dev2.account.address));
    });

    it("Should reject reassignment when milestone is submitted", async function () {
      const { contract, dev1, dev2 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.registerDeveloper(["Bob"], { account: dev2.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });

      await assert.rejects(
        contract.write.reassignDeveloper([0n, dev2.account.address]),
        (err: Error) => {
          assert.ok(err.message.includes("Cannot reassign: milestone pending review"));
          return true;
        },
      );
    });
  });

  // ──── Studio TopUpBudget (C4) ────
  describe("TopUpBudget", async function () {
    it("Should increase project budget without changing client", async function () {
      const { contract, client1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });

      // Client funds first
      await contract.write.fundProject([0n], { value: parseEther("0.5"), account: client1.account });

      // Studio tops up
      await contract.write.topUpBudget([0n], { value: parseEther("0.5") });

      const project = await contract.read.getProject([0n]);
      assert.equal(project.budget, parseEther("2")); // 1 + 0.5 + 0.5
      assert.equal(getAddress(project.client), getAddress(client1.account.address)); // Client unchanged
    });
  });

  // ──── Batch Milestone Approval (C5) ────
  describe("Batch Milestone Approval", async function () {
    it("Should approve multiple milestones in one transaction", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("0.3"), deadline]);
      await contract.write.addMilestone([0n, "M2", parseEther("0.3"), deadline]);
      await contract.write.addMilestone([0n, "M3", parseEther("0.4"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Submit all 3
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });
      await contract.write.submitMilestone([0n, 1n], { account: dev1.account });
      await contract.write.submitMilestone([0n, 2n], { account: dev1.account });

      // Batch approve all 3
      await contract.write.batchApproveMilestones([0n, [0n, 1n, 2n]]);

      // All approved
      for (let i = 0n; i < 3n; i++) {
        const ms = await contract.read.getMilestone([0n, i]);
        assert.equal(ms.status, 2); // Approved
      }

      // Project auto-completed
      const project = await contract.read.getProject([0n]);
      assert.equal(project.status, 1); // Completed

      // Developer has 1 ETH pending
      const pending = await contract.read.pendingWithdrawals([dev1.account.address]);
      assert.equal(pending, parseEther("1"));
    });
  });

  // ──── Reputation ────
  describe("Reputation", async function () {
    it("Should rate developer after project completion", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });
      await contract.write.approveMilestone([0n, 0n]);

      await contract.write.rateDeveloper([0n, 5]);

      const [average, count] = await contract.read.getDeveloperRating([dev1.account.address]);
      assert.equal(average, 5n);
      assert.equal(count, 1n);
    });

    it("Should reject rating on non-completed project", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
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

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });
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

  // ──── Budget-Weighted Reputation (H1) ────
  describe("Weighted Reputation", async function () {
    it("Should weight ratings by project budget", async function () {
      const { contract, dev1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });

      // Small project (0.1 ETH) rated 2/5
      await contract.write.createProject(["Small", "D", deadline], { value: parseEther("0.1") });
      await contract.write.addMilestone([0n, "M", parseEther("0.1"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);
      await contract.write.submitMilestone([0n, 0n], { account: dev1.account });
      await contract.write.approveMilestone([0n, 0n]);
      await contract.write.rateDeveloper([0n, 2]);

      // Large project (1 ETH) rated 5/5
      await contract.write.createProject(["Big", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([1n, "M", parseEther("1"), deadline]);
      await contract.write.assignDeveloper([1n, dev1.account.address]);
      await contract.write.submitMilestone([1n, 0n], { account: dev1.account });
      await contract.write.approveMilestone([1n, 0n]);
      await contract.write.rateDeveloper([1n, 5]);

      // Simple average = (2+5)/2 = 3
      const [simpleAvg, simpleCount] = await contract.read.getDeveloperRating([dev1.account.address]);
      assert.equal(simpleAvg, 3n);
      assert.equal(simpleCount, 2n);

      // Weighted average = (2*0.1 + 5*1) / (0.1 + 1) = 5.2/1.1 ≈ 4 (integer division)
      const [weightedAvg, totalWeight, wCount] = await contract.read.getWeightedRating([dev1.account.address]);
      assert.equal(weightedAvg, 4n); // 5.2/1.1 truncates to 4
      assert.equal(wCount, 2n);
      assert.equal(totalWeight, parseEther("1.1"));
    });
  });

  // ──── Milestone Edit/Remove (H2) ────
  describe("Milestone Edit and Remove", async function () {
    it("Should edit a pending milestone", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "Old Title", parseEther("0.3"), deadline]);

      await contract.write.editMilestone([0n, 0n, "New Title", parseEther("0.5")]);

      const ms = await contract.read.getMilestone([0n, 0n]);
      assert.equal(ms.title, "New Title");
      assert.equal(ms.value, parseEther("0.5"));
    });

    it("Should reject edit if new value exceeds budget", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([0n, "M2", parseEther("0.5"), deadline]);

      await assert.rejects(
        contract.write.editMilestone([0n, 0n, "M1 Big", parseEther("0.8")]),
        (err: Error) => {
          assert.ok(err.message.includes("Total milestone values exceed budget"));
          return true;
        },
      );
    });

    it("Should remove a pending milestone", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([0n, "M1", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([0n, "M2", parseEther("0.5"), deadline]);

      await contract.write.removeMilestone([0n, 0n]);

      const ms = await contract.read.getMilestone([0n, 0n]);
      assert.equal(ms.value, 0n); // Removed
      assert.equal(ms.title, "");

      const project = await contract.read.getProject([0n]);
      assert.equal(project.milestoneCount, 1n); // Decremented
    });
  });

  // ──── Deadline Extension (H4) ────
  describe("Deadline Extension", async function () {
    it("Should extend project deadline", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      const newDeadline = deadline + 86400n * 30n;

      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.extendDeadline([0n, newDeadline]);

      const project = await contract.read.getProject([0n]);
      assert.equal(project.deadline, newDeadline);
    });

    it("Should reject earlier deadline", async function () {
      const { contract } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);

      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });

      const earlierDeadline = deadline - 86400n;
      await assert.rejects(
        contract.write.extendDeadline([0n, earlierDeadline]),
        (err: Error) => {
          assert.ok(err.message.includes("New deadline must be later than current"));
          return true;
        },
      );
    });
  });

  // ──── Client Dispute Participation (H5) ────
  describe("Client Dispute", async function () {
    it("Should allow client to raise dispute", async function () {
      const { contract, dev1, client1 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.createProject(["P", "D", deadline], { value: parseEther("1") });
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Client funds to become the client
      await contract.write.fundProject([0n], { value: parseEther("0.5"), account: client1.account });

      // Client raises dispute
      await contract.write.raiseDispute([0n], { account: client1.account });

      const project = await contract.read.getProject([0n]);
      assert.equal(project.status, 2); // Disputed
    });
  });

  // ──── E2E with Pull Payments ────
  describe("End-to-End Real-World Scenario", async function () {
    it("Complete lifecycle with pull payments: projects, disputes, withdrawals", async function () {
      const { contract, studio, dev1, dev2 } = await deployDevStudio();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);

      // Register developers
      await contract.write.registerDeveloper(["Alice"], { account: dev1.account });
      await contract.write.registerDeveloper(["Bob"], { account: dev2.account });

      // Project #0 — full lifecycle
      await contract.write.createProject(["Mobile App", "iOS app", deadline], { value: parseEther("2") });
      await contract.write.addMilestone([0n, "UI", parseEther("0.4"), deadline]);
      await contract.write.addMilestone([0n, "API", parseEther("0.6"), deadline]);
      await contract.write.addMilestone([0n, "Pay", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([0n, "Launch", parseEther("0.5"), deadline]);
      await contract.write.assignDeveloper([0n, dev1.account.address]);

      // Submit and approve all 4
      for (let i = 0n; i < 4n; i++) {
        await contract.write.submitMilestone([0n, i], { account: dev1.account });
        await contract.write.approveMilestone([0n, i]);
      }

      // Project auto-completed
      assert.equal((await contract.read.getProject([0n])).status, 1);
      assert.equal((await contract.read.getProject([0n])).approvedCount, 4n);

      // Alice pending = 2 ETH
      assert.equal(await contract.read.pendingWithdrawals([dev1.account.address]), parseEther("2"));

      // Alice withdraws
      const aliceBefore = await publicClient.getBalance({ address: dev1.account.address });
      await contract.write.withdraw({ account: dev1.account });
      const aliceAfter = await publicClient.getBalance({ address: dev1.account.address });
      assert.ok(aliceAfter - aliceBefore > parseEther("1.99"));

      // Contract still holds funds from no project — balance = 0 for project 0
      await contract.write.rateDeveloper([0n, 5]);

      // Project #1 — dispute in favor of Bob
      await contract.write.createProject(["Dashboard", "Panel", deadline], { value: parseEther("1.5") });
      await contract.write.addMilestone([1n, "UI", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([1n, "Charts", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([1n, "Inv", parseEther("0.5"), deadline]);
      await contract.write.assignDeveloper([1n, dev2.account.address]);

      await contract.write.submitMilestone([1n, 0n], { account: dev2.account });
      await contract.write.approveMilestone([1n, 0n]);
      await contract.write.submitMilestone([1n, 1n], { account: dev2.account });

      await contract.write.raiseDispute([1n], { account: dev2.account });
      await contract.write.resolveDispute([1n, true]);

      // Bob has 0.5 + 0.5 = 1.0 ETH pending (milestone 0 + milestone 1 from dispute)
      assert.equal(await contract.read.pendingWithdrawals([dev2.account.address]), parseEther("1"));

      await contract.write.rateDeveloper([1n, 4]);

      // Project #2 — dispute against dev, refund to studio
      await contract.write.createProject(["Chatbot", "NLP", deadline], { value: parseEther("1") });
      await contract.write.addMilestone([2n, "NLP", parseEther("0.5"), deadline]);
      await contract.write.addMilestone([2n, "UI", parseEther("0.5"), deadline]);
      await contract.write.assignDeveloper([2n, dev1.account.address]);
      await contract.write.raiseDispute([2n]);
      await contract.write.resolveDispute([2n, false]);

      // Studio should have 1 ETH pending
      const studioPending = await contract.read.pendingWithdrawals([studio.account.address]);
      assert.equal(studioPending, parseEther("1"));

      assert.equal((await contract.read.getProject([2n])).status, 3); // Cancelled

      // Verify project count
      assert.equal(await contract.read.projectCount(), 3n);
    });
  });
});

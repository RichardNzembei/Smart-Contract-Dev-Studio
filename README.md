# Smart Contract Dev Studio

A milestone-based freelance project management dApp built on Ethereum. Studio owners create projects with ETH budgets, assign developers, and pay them upon milestone approval — all enforced on-chain.

## How It Works

```
Studio creates project (locks ETH)
  → Client optionally co-funds
  → Developer gets assigned
  → Developer submits milestones
  → Studio approves → ETH released to developer
  → Studio rates developer (1-5 stars)
```

**Three roles:**

- **Studio Owner** — Creates projects, manages milestones, approves work, resolves disputes
- **Developer** — Registers on-chain, submits milestones, withdraws earnings
- **Client** — Funds projects, monitors progress, can raise disputes

## Key Features

- **Milestone-based payments** — ETH locked in contract, released per milestone approval
- **Pull-based withdrawals** — Secure payment pattern preventing reentrancy attacks
- **Dispute resolution** — Proportional refunds based on funding contributions
- **Reputation system** — Budget-weighted developer ratings for fairer scoring
- **Client co-funding** — Multiple parties can fund the same project
- **Flexible management** — Edit/remove pending milestones, extend deadlines, reassign developers, top up budgets

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Contract | Solidity 0.8.28                     |
| Tooling  | Hardhat 3, Viem                     |
| Frontend | React, TypeScript, Vite, ethers.js  |
| Testing  | Node.js native test runner (`node:test`) |

## Project Structure

```
├── contracts/
│   └── DevStudio.sol          # Main contract
├── frontend/                  # React + Vite frontend
│   └── src/
│       ├── components/        # Role-specific dashboards, project views, shared UI
│       ├── hooks/             # useContract, useProjects
│       └── config/            # ABI, types, contract address
├── scripts/
│   ├── deploy.ts              # Deploy contract to local/testnet
│   ├── seed.ts                # Seed demo data (projects, developers, ratings)
│   └── e2e-verify.ts          # End-to-end verification script
├── src/
│   ├── DevStudioClient.ts     # Viem-based TypeScript client
│   └── types.ts               # Shared type definitions
├── test/
│   └── DevStudio.ts           # Contract unit tests
└── hardhat.config.ts
```

## Getting Started

### Prerequisites

- Node.js 22+ (required by Hardhat 3)
- npm

### Run Locally

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start a local Hardhat node
npm run node

# In a new terminal — deploy the contract
npm run deploy

# Seed demo data (optional, creates sample projects and developers)
npm run seed

# Start the frontend
cd frontend && npm run dev
```

The frontend runs at **http://localhost:5173** and connects to the local node at `http://127.0.0.1:8545`.

### Available Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run node`    | Start local Hardhat blockchain           |
| `npm run compile` | Compile Solidity contracts               |
| `npm run deploy`  | Deploy DevStudio to local node           |
| `npm run seed`    | Seed demo projects, developers & ratings |
| `npm run test`    | Run contract tests                       |
| `npm run e2e`     | Run end-to-end verification              |

### Environment Variables

The frontend reads from `frontend/.env.local`:

```env
VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
VITE_RPC_URL=http://127.0.0.1:8545
```

These defaults match the first Hardhat deployment address and local node.

## Contract Overview

The `DevStudio.sol` contract manages:

- **Developer registration** — Self-register with a display name
- **Project lifecycle** — Create → Assign → Milestones → Complete/Cancel
- **Milestone workflow** — Add → Submit → Approve → Withdraw
- **Dispute handling** — Raise → Resolve (in favor or against developer, with proportional refunds)
- **Ratings** — Simple average and budget-weighted reputation scoring

### Networks

Configured in `hardhat.config.ts`:

| Network          | Type           | Description                    |
|------------------|----------------|--------------------------------|
| `localhost`      | HTTP           | Local Hardhat node             |
| `hardhatMainnet` | EDR-simulated  | In-process Ethereum L1         |
| `hardhatOp`      | EDR-simulated  | In-process Optimism            |
| `sepolia`        | HTTP           | Ethereum testnet               |
| `besu`           | HTTP           | Hyperledger Besu compatibility |

### Deploying to Sepolia

```bash
# Set your credentials
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set SEPOLIA_RPC_URL

# Deploy
npx hardhat ignition deploy --network sepolia ignition/modules/DevStudio.ts
```

Update `frontend/.env.local` with the deployed contract address and your Sepolia RPC URL.

## License

ISC

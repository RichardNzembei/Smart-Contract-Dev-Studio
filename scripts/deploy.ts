import { ethers } from "ethers";
import { readFileSync } from "fs";

const RPC_URL = "http://127.0.0.1:8545";
// Hardhat test account #0 private key
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const artifact = JSON.parse(
    readFileSync("artifacts/contracts/DevStudio.sol/DevStudio.json", "utf-8")
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying DevStudio...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`DevStudio deployed to: ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

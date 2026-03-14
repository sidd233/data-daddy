import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const registryAddress = process.env.CERTIFICATE_REGISTRY_ADDRESS;
  if (!registryAddress) throw new Error("CERTIFICATE_REGISTRY_ADDRESS not set");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set (no 0x prefix needed)");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(`0x${privateKey.replace(/^0x/, "")}`, provider);

  console.log("Deployer:", wallet.address);
  console.log("CertificateRegistry:", registryAddress);

  // Load compiled artifact
  const artifactPath = join(__dirname, "../artifacts/contracts/LabellingPool.sol/LabellingPool.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(registryAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nLabellingPool deployed to:", address);
  console.log("\nAdd to packages/frontend/.env.local:");
  console.log(`NEXT_PUBLIC_LABELLING_POOL_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

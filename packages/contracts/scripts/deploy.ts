import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

// On Base Sepolia, Anon Aadhaar has no official deployment.
// We deploy MockAnonAadhaar as a stand-in so ZKVerifier is still wired up.
// For mainnet/Ethereum Sepolia, replace this with the real address and
// remove the mock deployment step.
const USE_MOCK_ANON_AADHAAR = true;
const REAL_ANON_AADHAAR_VERIFIER = "0x6375394335f34848b850114b66A49D6F47f2cdA8";

function getRpcUrl(): string {
  if (process.env.BASE_SEPOLIA_RPC_URL) return process.env.BASE_SEPOLIA_RPC_URL;
  if (process.env.RPC_URL) return process.env.RPC_URL;
  return "http://127.0.0.1:8545";
}

async function main() {
  const provider = new ethers.JsonRpcProvider(getRpcUrl());

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");

  const deployer = new ethers.Wallet(`0x${privateKey}`, provider);
  let nonce = await provider.getTransactionCount(deployer.address, "pending");

  const network = await provider.getNetwork();
  console.log("Network:  ", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Nonce:    ", nonce);
  console.log("Balance:  ", ethers.formatEther(await provider.getBalance(deployer.address)), "ETH");

  // ── 1. Deploy CertificateRegistry ─────────────────────────────────────────
  console.log("\nDeploying CertificateRegistry...");
  const certRegArtifact = await hre.artifacts.readArtifact("CertificateRegistry");
  const CertReg = new ethers.ContractFactory(certRegArtifact.abi, certRegArtifact.bytecode, deployer);
  const certReg = await CertReg.deploy({ nonce: nonce++ });
  await certReg.waitForDeployment();
  const certRegAddr = await certReg.getAddress();
  console.log("CertificateRegistry:", certRegAddr);

  // ── 2. Deploy LeaseManager ────────────────────────────────────────────────
  console.log("\nDeploying LeaseManager...");
  const leaseMgrArtifact = await hre.artifacts.readArtifact("LeaseManager");
  const LeaseMgr = new ethers.ContractFactory(leaseMgrArtifact.abi, leaseMgrArtifact.bytecode, deployer);
  const leaseMgr = await LeaseMgr.deploy(deployer.address, { nonce: nonce++ });
  await leaseMgr.waitForDeployment();
  const leaseMgrAddr = await leaseMgr.getAddress();
  console.log("LeaseManager:", leaseMgrAddr);

  // ── 3. Deploy AnonAadhaar verifier (mock or real) ─────────────────────────
  let anonAadhaarAddr: string;

  if (USE_MOCK_ANON_AADHAAR) {
    console.log("\nDeploying MockAnonAadhaar (Base Sepolia stand-in)...");
    const mockArtifact = await hre.artifacts.readArtifact("MockAnonAadhaar");
    const Mock = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, deployer);
    const mock = await Mock.deploy({ nonce: nonce++ });
    await mock.waitForDeployment();
    anonAadhaarAddr = await mock.getAddress();
    console.log("MockAnonAadhaar:", anonAadhaarAddr);

    // Set mock to pass by default so demo works out of the box
    const tx = await (mock as any).setResult(true, { nonce: nonce++ });
    await tx.wait();
    console.log("MockAnonAadhaar.setShouldPass(true) ✓");
  } else {
    anonAadhaarAddr = REAL_ANON_AADHAAR_VERIFIER;
    console.log("\nUsing real AnonAadhaar verifier:", anonAadhaarAddr);
  }

  // ── 4. Deploy AnonAadhaarZKVerifier ───────────────────────────────────────
  console.log("\nDeploying AnonAadhaarZKVerifier...");
  const zkArtifact = await hre.artifacts.readArtifact("AnonAadhaarZKVerifier");
  const ZKVerifier = new ethers.ContractFactory(zkArtifact.abi, zkArtifact.bytecode, deployer);
  const zkVerifier = await ZKVerifier.deploy(anonAadhaarAddr, { nonce: nonce++ });
  await zkVerifier.waitForDeployment();
  const zkVerifierAddr = await zkVerifier.getAddress();
  console.log("AnonAadhaarZKVerifier:", zkVerifierAddr);

  // ── 5. Wire contracts ──────────────────────────────────────────────────────
  console.log("\nWiring contracts...");

  const tx1 = await (leaseMgr as any).setCertificateRegistry(certRegAddr, { nonce: nonce++ });
  await tx1.wait();
  console.log("LeaseManager.setCertificateRegistry ✓");

  const tx2 = await (certReg as any).addIssuer(deployer.address, { nonce: nonce++ });
  await tx2.wait();
  console.log("CertificateRegistry.addIssuer(deployer) ✓");

  const tx3 = await (leaseMgr as any).setAiIssuerAddress(deployer.address, { nonce: nonce++ });
  await tx3.wait();
  console.log("LeaseManager.setAiIssuerAddress(deployer) ✓");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== Deployment complete ===");
  console.log("CertificateRegistry:   ", certRegAddr);
  console.log("LeaseManager:          ", leaseMgrAddr);
  console.log("MockAnonAadhaar:       ", USE_MOCK_ANON_AADHAAR ? anonAadhaarAddr : "n/a (using real)");
  console.log("AnonAadhaarZKVerifier: ", zkVerifierAddr);
  console.log("\n── Add to .env ───────────────────────────────────────────");
  console.log(`CERTIFICATE_REGISTRY_ADDRESS=${certRegAddr}`);
  console.log(`LEASE_MANAGER_ADDRESS=${leaseMgrAddr}`);
  console.log(`ZK_VERIFIER_ADDRESS=${zkVerifierAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

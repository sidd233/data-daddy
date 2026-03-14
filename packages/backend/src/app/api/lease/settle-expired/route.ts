import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import pool from "@/lib/db";

const LEASE_MANAGER_ABI = [
  {
    name: "settleLease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "leaseId", type: "uint256" }],
    outputs: [],
  },
] as const;

/**
 * POST /api/lease/settle-expired
 * Permissionless — anyone can trigger. Settles all expired active leases on-chain
 * and marks them Settled in the DB.
 */
export async function POST() {
  const privateKey = process.env.ISSUER_PRIVATE_KEY;
  const rpcUrl = process.env.ALCHEMY_RPC;
  const leaseManagerAddress = process.env.LEASE_MANAGER_ADDRESS as `0x${string}` | undefined;

  if (!privateKey || !rpcUrl || !leaseManagerAddress) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Find all active leases that have expired
  const { rows: expired } = await pool.query(
    `SELECT id, on_chain_id FROM leases
     WHERE status = 'Active' AND expires_at <= NOW()`
  );

  if (expired.length === 0) {
    return NextResponse.json({ settled: 0 });
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });

  let settled = 0;
  const failed: number[] = [];

  for (const lease of expired) {
    try {
      const hash = await walletClient.writeContract({
        address: leaseManagerAddress,
        abi: LEASE_MANAGER_ABI,
        functionName: "settleLease",
        args: [BigInt(lease.on_chain_id)],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      await pool.query(
        `UPDATE leases SET status = 'Settled', settled_at = NOW() WHERE id = $1`,
        [lease.id]
      );
      settled++;
    } catch {
      // Lease may not exist on-chain (off-chain approved) — settle in DB anyway
      await pool.query(
        `UPDATE leases SET status = 'Settled', settled_at = NOW() WHERE id = $1`,
        [lease.id]
      );
      settled++;
      failed.push(lease.on_chain_id);
    }
  }

  return NextResponse.json({ settled, onChainFailed: failed });
}

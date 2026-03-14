# DataDaddy — Contracts

Solidity 0.8.28 smart contracts for the DataDaddy data leasing protocol. Two immutable contracts deployed on Base Sepolia.

## Stack

| | |
|--|--|
| Toolchain | Hardhat 3 Beta |
| Language | Solidity 0.8.28 |
| Libraries | OpenZeppelin 5.x, Anon Aadhaar contracts |
| Testing | Foundry (forge-std) |
| Chain | Base Sepolia (chainId 84532) |

## Contracts

### CertificateRegistry.sol

ERC-5192 soulbound token (extends ERC-721, `locked()` always returns `true`). Stores credential proofs on-chain.

- `mintCertificate(address owner, bytes32 attrKey, uint8 confidence, uint40 expiresAt)` — issuer only
- `revokeCertificate(uint256 tokenId)` — issuer only
- `getTokenId(address owner, bytes32 attrKey)` — lookup token by owner + attribute
- `isValid(uint256 tokenId)` — non-revoked check
- `locked(uint256)` — always `true` (ERC-5192)
- Transfers always revert — soulbound
- Attribute values are **never stored on-chain** — only `attributeKey` hash + `confidenceLevel`

**Deployed:** `0xBcF8f15E2c981663A08Db3878B994d65ddd84944`

### LeaseManager.sol

Pull-over-push escrow for data leases. ETH held in contract until settlement or revocation.

- `postRequest(attrKey, minConf, aiAllowed, pricePerUser, duration, reqExpiry, maxUsers)` — buyer, payable (`msg.value = pricePerUser * maxUsers`)
- `approveLease(requestId, certificateTokenId)` — user with valid certificate
- `settleLease(leaseId)` — permissionless, requires `block.timestamp >= lease.expiresAt`
- `revokeLease(leaseId)` — user only, forfeits full payment
- `withdrawUnfilledEscrow(requestId)` — buyer, after request expires

**Deployed:** `0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00`

### Supporting Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| AnonAadhaarZKVerifier | `0xA205f7DED9430ac03b7F0CD3eA1b22C54C1A1453` | On-chain ZK verifier for Anon Aadhaar proofs |
| MockAnonAadhaar | `0x68AACB01AaeD9cAC1D46aD248F35cBd2F554F7D0` | Mock verifier for local/test use |

## Commands

```bash
# Compile
npx hardhat compile

# Test (Foundry)
npx hardhat test

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.ts --network baseSepolia
```

## Tests

166 passing Foundry tests:
- `CertificateRegistry.t.sol` — 67 tests
- `LeaseManager.t.sol` — 97 tests
- `AnonAadhaarZKVerifierTest.t.sol` — 2 tests

## AttributeKey Convention

All attribute keys are stored on-chain as `bytes32` keccak256 hashes:

```solidity
bytes32 constant DEFI_USER = keccak256("defi_user");
```

```typescript
// TypeScript (viem)
import { keccak256, toHex } from "viem"
const key = keccak256(toHex("defi_user"))
```

Canonical attribute strings:
- Tier 1: `defi_user`, `asset_holder`, `active_wallet`, `long_term_holder`, `nft_holder`
- Tier 2: `age_range`, `state_of_residence`
- Tier 3: any string (AI document verification)

## Design Rules

- **Two contracts only** — no third contract (D-03)
- **No proxies** — immutable deploy (D-02)
- **No attribute values on-chain** — only key hash + confidence (D-09)
- **Pull-over-push escrow** — ETH held until `settleLease` is called (D-05)
- **permissionless `settleLease`** — anyone can trigger after expiry (D-19)
- **`call{value}()` not `transfer()`** — all ETH transfers
- **`nonReentrant`** on all escrow functions
- **ERC-5192** soulbound — `locked()` always `true`, transfers always revert (D-07)

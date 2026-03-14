# CONTRACT_SPEC.md — DataDaddy

> **Purpose:** Final contract functions, params, events, revert conditions.
> **Prevents:** Frontend–contract mismatch.
> **Update rule:** Once, after contracts are finalized on Day 2. Never again.
> **Authority:** If this file conflicts with ARCHITECTURE.md, this file wins for contract specifics.

---

## Addresses

Fill in after Day 2 deploy. Never leave blank when going to demo.

```
Network:                    Base Sepolia (chainId: 84532)
CertificateRegistry:        0xBcF8f15E2c981663A08Db3878B994d65ddd84944
LeaseManager:               0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00
AnonAadhaar Verifier:       0xA205f7DED9430ac03b7F0CD3eA1b22C54C1A1453  (AnonAadhaarZKVerifier)
MockAnonAadhaar:            0x68AACB01AaeD9cAC1D46aD248F35cBd2F554F7D0  (Base Sepolia stand-in)
Deployer / Issuer Wallet:   0xCaE780beffd68d4F3a9d0DAbC2Dcb66858aCFdf2
Basescan (Registry):        https://sepolia.basescan.org/address/0xBcF8f15E2c981663A08Db3878B994d65ddd84944
Basescan (LeaseManager):    https://sepolia.basescan.org/address/0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00
```

---

## Compiler Settings

```json
{
  "solidity": "0.8.28",
  "optimizer": { "enabled": true, "runs": 200 },
  "viaIR": false
}
```

---

## 1. CertificateRegistry.sol

**Inherits:** `ERC721`, `ReentrancyGuard`, `Ownable`  
**Standard:** ERC-5192 (Minimal Soulbound Token)  
**Rule:** `locked()` always returns `true`. `transferFrom` / `safeTransferFrom` always revert.

---

### Structs

```solidity
struct Certificate {
    address owner;           // wallet that owns this cert
    bytes32 attributeKey;    // keccak256 of attribute name string
    uint8 confidenceLevel;   // 0–100 integer (e.g. 91 = 91%)
    uint40 issuedAt;         // unix timestamp
    uint40 expiresAt;        // unix timestamp; 0 = no expiry
    address issuer;          // issuer wallet address
    bool revoked;
}
```

---

### Storage

```solidity
mapping(uint256 tokenId => Certificate) public certificates;
mapping(address owner => mapping(bytes32 attrKey => uint256 tokenId)) public ownerAttrToken;
mapping(address => bool) public authorizedIssuers;
uint256 private _tokenIdCounter;   // starts at 1
```

---

### Functions

#### `mintCertificate`

```solidity
function mintCertificate(
    address owner,           // wallet receiving the SBT
    bytes32 attributeKey,    // keccak256("age_range") etc.
    uint8 confidenceLevel,   // 0–100
    uint40 expiresAt         // 0 = no expiry
)
    external
    onlyIssuer
    returns (uint256 tokenId)
```

**Behaviour:**
- Increments `_tokenIdCounter` and assigns as `tokenId`
- Writes `Certificate` struct to `certificates[tokenId]`
- Writes `tokenId` to `ownerAttrToken[owner][attributeKey]`
- Mints ERC-721 token to `owner`
- Emits `CertificateMinted`

**Reverts:**
| Condition | Revert message |
|-----------|---------------|
| `msg.sender` not in `authorizedIssuers` | `"Not authorized"` |
| `owner == address(0)` | `"Invalid owner"` |
| `confidenceLevel > 100` | `"Invalid confidence"` |
| `ownerAttrToken[owner][attributeKey] != 0` and existing cert not revoked | `"Cert already exists"` |

---

#### `revokeCertificate`

```solidity
function revokeCertificate(uint256 tokenId)
    external
    onlyIssuer
```

**Behaviour:**
- Sets `certificates[tokenId].revoked = true`
- Emits `CertificateRevoked`
- Does NOT burn the token — token remains minted, just flagged revoked

**Reverts:**
| Condition | Revert message |
|-----------|---------------|
| `msg.sender` not in `authorizedIssuers` | `"Not authorized"` |
| `tokenId` does not exist | `"Token does not exist"` |
| Already revoked | `"Already revoked"` |

---

#### `addIssuer` / `removeIssuer`

```solidity
function addIssuer(address issuer) external onlyOwner
function removeIssuer(address issuer) external onlyOwner
```

**Reverts:** `msg.sender != owner` → OZ Ownable default revert.

---

#### `locked` (ERC-5192)

```solidity
function locked(uint256 tokenId) external pure returns (bool)
// Always returns true. No exceptions.
```

---

#### `transferFrom` / `safeTransferFrom` (overridden)

```solidity
// Both overrides:
revert("Soulbound: non-transferable");
```

---

#### `getCertificate`

```solidity
function getCertificate(uint256 tokenId)
    external view
    returns (Certificate memory)
```

**Reverts:** Token does not exist → `"Token does not exist"`

---

#### `getTokenId`

```solidity
function getTokenId(address owner, bytes32 attributeKey)
    external view
    returns (uint256 tokenId)
// Returns 0 if no cert exists for this owner+attributeKey combination.
```

---

#### `isValid`

```solidity
function isValid(uint256 tokenId)
    external view
    returns (bool)
// Returns true if: token exists AND certificate.revoked == false
// AND (certificate.expiresAt == 0 OR block.timestamp < certificate.expiresAt)
```

---

### Events

```solidity
event CertificateMinted(
    uint256 indexed tokenId,
    address indexed owner,
    bytes32 indexed attributeKey,
    uint8 confidence,
    uint40 issuedAt
);

event CertificateRevoked(
    uint256 indexed tokenId,
    address indexed owner,
    bytes32 indexed attributeKey
);

event IssuerAdded(address indexed issuer);
event IssuerRemoved(address indexed issuer);
```

---

### Modifiers

```solidity
modifier onlyIssuer() {
    require(authorizedIssuers[msg.sender], "Not authorized");
    _;
}
```

---

## 2. LeaseManager.sol

**Inherits:** `ReentrancyGuard`, `Ownable`  
**Payment token:** Native ETH (demo). Production: ERC-20 USDC.  
**Pattern:** Pull-over-push escrow. State machine per lease.

---

### Enums

```solidity
enum LeaseStatus { Funded, Active, Settled, Revoked, Cancelled }
```

| Value | Meaning |
|-------|---------|
| `Funded` | Buyer deposited escrow. No user has approved yet for this slot. |
| `Active` | User approved. Payment earmarked. Lease running. |
| `Settled` | Lease expired. Payment released to user. |
| `Revoked` | User revoked early. Payment forfeited. |
| `Cancelled` | Buyer withdrew unfilled escrow after `requestExpiry`. |

---

### Structs

```solidity
struct LeaseRequest {
    address buyer;
    bytes32 attributeKey;
    uint8 minConfidence;          // 0–100
    bool aiAllowed;               // buyer opts into AI fallback tier
    uint256 pricePerUser;         // wei per lease slot
    uint40 leaseDurationSec;      // lease length in seconds
    uint40 requestExpiry;         // unix ts; request auto-cancels if unfilled
    uint256 escrowBalance;        // remaining unfilled ETH held
    uint256 maxUsers;             // max lease slots
    uint256 filledCount;          // approved lease slots so far
    bool active;                  // false after requestExpiry or fully filled
}

struct Lease {
    uint256 requestId;
    address user;
    uint256 certificateTokenId;
    LeaseStatus status;
    uint40 startedAt;
    uint40 expiresAt;
    uint256 paidAmount;           // wei held for this lease slot
}
```

---

### Storage

```solidity
mapping(uint256 requestId => LeaseRequest) public leaseRequests;
mapping(uint256 leaseId => Lease) public leases;
mapping(uint256 requestId => mapping(address user => bool)) public requestFilledByUser;

uint256 private _requestIdCounter;   // starts at 1
uint256 private _leaseIdCounter;     // starts at 1

address public certificateRegistry;  // set in constructor, immutable after
```

---

### Functions

#### `postRequest`

```solidity
function postRequest(
    bytes32 attrKey,
    uint8 minConf,          // 0–100
    bool aiAllowed,
    uint256 pricePerUser,   // wei
    uint40 duration,        // seconds
    uint40 reqExpiry,       // unix timestamp
    uint256 maxUsers
)
    external
    payable
    returns (uint256 requestId)
```

**Behaviour:**
- `msg.value` must equal `pricePerUser * maxUsers`
- Increments `_requestIdCounter`, stores `LeaseRequest`
- Sets `escrowBalance = msg.value`
- Emits `RequestPosted`

**Reverts:**
| Condition | Revert message |
|-----------|---------------|
| `msg.value != pricePerUser * maxUsers` | `"Incorrect escrow amount"` |
| `maxUsers == 0` | `"maxUsers must be > 0"` |
| `pricePerUser == 0` | `"pricePerUser must be > 0"` |
| `reqExpiry <= block.timestamp` | `"Request already expired"` |
| `duration == 0` | `"Duration must be > 0"` |

---

#### `approveLease`

```solidity
function approveLease(
    uint256 requestId,
    uint256 certificateTokenId
)
    external
    nonReentrant
    returns (uint256 leaseId)
```

**Validation sequence (enforced in this order):**
1. `leaseRequests[requestId].buyer != address(0)` → `"Request does not exist"`
2. `leaseRequests[requestId].active == true` → `"Request not active"`
3. `block.timestamp <= leaseRequests[requestId].requestExpiry` → `"Request expired"`
4. `ICertificateRegistry(certificateRegistry).isValid(certificateTokenId)` → `"Certificate invalid or revoked"`
5. `certificates[certificateTokenId].owner == msg.sender` → `"Not certificate owner"`
6. `certificates[certificateTokenId].attributeKey == leaseRequests[requestId].attributeKey` → `"Attribute mismatch"`
7. `certificates[certificateTokenId].confidenceLevel >= leaseRequests[requestId].minConfidence` → `"Confidence too low"`
8. If cert method requires `aiAllowed` check (verified via cert's `issuer` or a flag on cert): `leaseRequests[requestId].aiAllowed == true` → `"AI certs not accepted"`
9. `!requestFilledByUser[requestId][msg.sender]` → `"Already approved"`
10. `leaseRequests[requestId].filledCount < leaseRequests[requestId].maxUsers` → `"Request fully filled"`

**Behaviour after validation:**
- Increments `_leaseIdCounter`, creates `Lease{status: Active}`
- Decrements `leaseRequests[requestId].escrowBalance` by `pricePerUser`
- Sets `requestFilledByUser[requestId][msg.sender] = true`
- Increments `leaseRequests[requestId].filledCount`
- If `filledCount == maxUsers`: sets `active = false`
- Emits `LeaseApproved`
- Returns `leaseId`

> **Note on AI cert check (step 8):** `CertificateRegistry` stores `issuer` per cert. The backend issues AI-tier certs from a dedicated sub-address flagged as `AI_ISSUER`. `LeaseManager` stores `aiIssuerAddress` and checks `cert.issuer == aiIssuerAddress` to identify AI-tier certs. Alternatively, add a `bool aiDerived` field to `Certificate` struct set by the issuer at mint time.

---

#### `settleLease`

```solidity
function settleLease(uint256 leaseId)
    external
    nonReentrant
```

**Behaviour:**
- Validates `leases[leaseId].status == Active` → `"Lease not active"`
- Validates `block.timestamp >= leases[leaseId].expiresAt` → `"Lease not yet expired"`
- Sets `leases[leaseId].status = Settled`
- Transfers `leases[leaseId].paidAmount` to `leases[leaseId].user` via `call{value}`
- Emits `LeaseSettled`
- **Caller:** Anyone can call this after expiry (permissionless settlement). Demo: Vercel cron. Production: Chainlink Automation.

**ETH transfer pattern (mandatory):**
```solidity
(bool sent, ) = payable(leases[leaseId].user).call{value: leases[leaseId].paidAmount}("");
require(sent, "ETH transfer failed");
```

**Reverts:**
| Condition | Revert message |
|-----------|---------------|
| `status != Active` | `"Lease not active"` |
| `block.timestamp < expiresAt` | `"Lease not yet expired"` |
| ETH transfer fails | `"ETH transfer failed"` |

---

#### `revokeLease`

```solidity
function revokeLease(uint256 leaseId)
    external
    nonReentrant
```

**Behaviour:**
- Validates `msg.sender == leases[leaseId].user` → `"Not lease owner"`
- Validates `leases[leaseId].status == Active` → `"Lease not active"`
- Sets `leases[leaseId].status = Revoked`
- `paidAmount` stays in contract (claimable by protocol treasury or returned to buyer — TBD for production; for demo, stays in contract)
- Emits `LeaseRevoked`

**Reverts:**
| Condition | Revert message |
|-----------|---------------|
| `msg.sender != lease.user` | `"Not lease owner"` |
| `status != Active` | `"Lease not active"` |

---

#### `withdrawUnfilledEscrow`

```solidity
function withdrawUnfilledEscrow(uint256 requestId)
    external
    nonReentrant
```

**Behaviour:**
- Validates `msg.sender == leaseRequests[requestId].buyer` → `"Not request owner"`
- Validates `block.timestamp > leaseRequests[requestId].requestExpiry` → `"Request not yet expired"`
- Validates `leaseRequests[requestId].escrowBalance > 0` → `"No escrow to withdraw"`
- Transfers `escrowBalance` to buyer via `call{value}`
- Sets `escrowBalance = 0`, `active = false`
- Emits `RequestExpired`

**Reverts:**
| Condition | Revert message |
|-----------|---------------|
| `msg.sender != request.buyer` | `"Not request owner"` |
| `block.timestamp <= requestExpiry` | `"Request not yet expired"` |
| `escrowBalance == 0` | `"No escrow to withdraw"` |
| ETH transfer fails | `"ETH transfer failed"` |

---

#### `setCertificateRegistry`

```solidity
function setCertificateRegistry(address registry)
    external
    onlyOwner
```

Called once at deploy. Sets the `certificateRegistry` address used in `approveLease` validation.

---

#### Read Functions

```solidity
function getRequest(uint256 requestId)
    external view
    returns (LeaseRequest memory)

function getLease(uint256 leaseId)
    external view
    returns (Lease memory)

function hasUserFilledRequest(uint256 requestId, address user)
    external view
    returns (bool)
```

---

### Events

```solidity
event RequestPosted(
    uint256 indexed requestId,
    address indexed buyer,
    bytes32 indexed attrKey,
    uint256 pricePerUser,
    uint256 maxUsers,
    uint40 requestExpiry
);

event LeaseApproved(
    uint256 indexed leaseId,
    uint256 indexed requestId,
    address indexed user,
    bytes32 attrKey,
    uint8 confidence,
    uint40 expiresAt
);

event LeaseSettled(
    uint256 indexed leaseId,
    address indexed user,
    uint256 amount
);

event LeaseRevoked(
    uint256 indexed leaseId,
    uint256 indexed requestId,
    address indexed user
);

event RequestExpired(
    uint256 indexed requestId,
    address indexed buyer,
    uint256 escrowReturned
);
```

---

## 3. IZKVerifier.sol

Implemented by each ZK provider's on-chain verifier. Not deployed by DataDaddy.

```solidity
// interfaces/IZKVerifier.sol
interface IZKVerifier {
    /// @param proof      Encoded proof bytes (provider-specific format)
    /// @param context    Provider-specific context (nullifier seed, appId, etc.)
    /// @return valid         Whether the proof cryptographically verifies
    /// @return attributeKey  keccak256 attribute this proof attests to
    /// @return confidence    0–100 (always 100 for valid ZK proofs)
    function verifyProof(
        bytes calldata proof,
        bytes calldata context
    )
        external view
        returns (bool valid, bytes32 attributeKey, uint8 confidence);
}
```

---

## 4. AttributeKey Reference

All attribute keys are `keccak256` hashes of their canonical string name. Use these constants everywhere — contracts, backend, frontend. Never hardcode raw `bytes32` values inline.

```solidity
// In Solidity:
bytes32 constant DEFI_USER          = keccak256("defi_user");
bytes32 constant ASSET_HOLDER       = keccak256("asset_holder");
bytes32 constant ACTIVE_WALLET      = keccak256("active_wallet");
bytes32 constant LONG_TERM_HOLDER   = keccak256("long_term_holder");
bytes32 constant NFT_HOLDER         = keccak256("nft_holder");
bytes32 constant AGE_RANGE          = keccak256("age_range");
bytes32 constant STATE_OF_RESIDENCE = keccak256("state_of_residence");
```

```typescript
// In TypeScript (viem):
import { keccak256, toHex } from "viem";

export const ATTRIBUTE_KEYS = {
  defi_user:          keccak256(toHex("defi_user")),
  asset_holder:       keccak256(toHex("asset_holder")),
  active_wallet:      keccak256(toHex("active_wallet")),
  long_term_holder:   keccak256(toHex("long_term_holder")),
  nft_holder:         keccak256(toHex("nft_holder")),
  age_range:          keccak256(toHex("age_range")),
  state_of_residence: keccak256(toHex("state_of_residence")),
} as const;
```

> **Critical:** `keccak256("age_range")` in Solidity and `keccak256(toHex("age_range"))` in viem must produce identical `bytes32` values. Verify this in a unit test before any integration work.

---

## 5. Frontend Integration Patterns

### Reading a Certificate

```typescript
import { useReadContract } from "wagmi";
import { CERTIFICATE_REGISTRY } from "@/shared/contracts";
import { ATTRIBUTE_KEYS } from "@/shared/attributeKeys";

// Get tokenId for a wallet + attribute
const { data: tokenId } = useReadContract({
  ...CERTIFICATE_REGISTRY,
  functionName: "getTokenId",
  args: [address, ATTRIBUTE_KEYS.defi_user],
});

// Check if valid
const { data: isValid } = useReadContract({
  ...CERTIFICATE_REGISTRY,
  functionName: "isValid",
  args: [tokenId],
  enabled: !!tokenId && tokenId !== 0n,
});

// Get full cert struct
const { data: cert } = useReadContract({
  ...CERTIFICATE_REGISTRY,
  functionName: "getCertificate",
  args: [tokenId],
  enabled: !!tokenId && tokenId !== 0n,
});
```

### Posting a Lease Request (Buyer)

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";

const { writeContract, data: hash } = useWriteContract();
const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

writeContract({
  ...LEASE_MANAGER,
  functionName: "postRequest",
  args: [
    ATTRIBUTE_KEYS.defi_user,     // attrKey bytes32
    80n,                           // minConf uint8
    false,                         // aiAllowed bool
    parseEther("0.001"),           // pricePerUser uint256 wei
    86400n,                        // duration uint40 seconds
    BigInt(Math.floor(Date.now() / 1000) + 86400 * 7), // reqExpiry
    10n,                           // maxUsers
  ],
  value: parseEther("0.001") * 10n,  // pricePerUser * maxUsers
});
```

### Approving a Lease (User)

```typescript
const { writeContract, data: hash } = useWriteContract();
const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

writeContract({
  ...LEASE_MANAGER,
  functionName: "approveLease",
  args: [
    BigInt(requestId),          // requestId
    BigInt(certificateTokenId), // certificateTokenId
  ],
});
```

### Revoking a Lease (User)

```typescript
writeContract({
  ...LEASE_MANAGER,
  functionName: "revokeLease",
  args: [BigInt(leaseId)],
});
```

### Settling a Lease (Cron / Anyone)

```typescript
writeContract({
  ...LEASE_MANAGER,
  functionName: "settleLease",
  args: [BigInt(leaseId)],
});
```

### Listening for Events

```typescript
import { useWatchContractEvent } from "wagmi";

// Watch for new lease approvals
useWatchContractEvent({
  ...LEASE_MANAGER,
  eventName: "LeaseApproved",
  args: { user: address },
  onLogs(logs) {
    // refetch active leases
  },
});
```

---

## 6. ABI Fragments (Critical Functions Only)

Minimal ABI for frontend if TypeChain isn't available. Use generated types where possible.

```typescript
export const CERTIFICATE_REGISTRY_ABI = [
  {
    name: "mintCertificate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "attributeKey", type: "bytes32" },
      { name: "confidenceLevel", type: "uint8" },
      { name: "expiresAt", type: "uint40" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "revokeCertificate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getTokenId",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "attributeKey", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "isValid",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getCertificate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "attributeKey", type: "bytes32" },
          { name: "confidenceLevel", type: "uint8" },
          { name: "issuedAt", type: "uint40" },
          { name: "expiresAt", type: "uint40" },
          { name: "issuer", type: "address" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "locked",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "CertificateMinted",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "attributeKey", type: "bytes32", indexed: true },
      { name: "confidence", type: "uint8", indexed: false },
      { name: "issuedAt", type: "uint40", indexed: false },
    ],
  },
  {
    name: "CertificateRevoked",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "attributeKey", type: "bytes32", indexed: true },
    ],
  },
] as const;

export const LEASE_MANAGER_ABI = [
  {
    name: "postRequest",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "attrKey", type: "bytes32" },
      { name: "minConf", type: "uint8" },
      { name: "aiAllowed", type: "bool" },
      { name: "pricePerUser", type: "uint256" },
      { name: "duration", type: "uint40" },
      { name: "reqExpiry", type: "uint40" },
      { name: "maxUsers", type: "uint256" },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    name: "approveLease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "certificateTokenId", type: "uint256" },
    ],
    outputs: [{ name: "leaseId", type: "uint256" }],
  },
  {
    name: "settleLease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "leaseId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "revokeLease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "leaseId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdrawUnfilledEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getRequest",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "attributeKey", type: "bytes32" },
          { name: "minConfidence", type: "uint8" },
          { name: "aiAllowed", type: "bool" },
          { name: "pricePerUser", type: "uint256" },
          { name: "leaseDurationSec", type: "uint40" },
          { name: "requestExpiry", type: "uint40" },
          { name: "escrowBalance", type: "uint256" },
          { name: "maxUsers", type: "uint256" },
          { name: "filledCount", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getLease",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "leaseId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "requestId", type: "uint256" },
          { name: "user", type: "address" },
          { name: "certificateTokenId", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "startedAt", type: "uint40" },
          { name: "expiresAt", type: "uint40" },
          { name: "paidAmount", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "LeaseApproved",
    type: "event",
    inputs: [
      { name: "leaseId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "attrKey", type: "bytes32", indexed: false },
      { name: "confidence", type: "uint8", indexed: false },
      { name: "expiresAt", type: "uint40", indexed: false },
    ],
  },
  {
    name: "LeaseSettled",
    type: "event",
    inputs: [
      { name: "leaseId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "LeaseRevoked",
    type: "event",
    inputs: [
      { name: "leaseId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
    ],
  },
  {
    name: "RequestPosted",
    type: "event",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "attrKey", type: "bytes32", indexed: true },
      { name: "pricePerUser", type: "uint256", indexed: false },
      { name: "maxUsers", type: "uint256", indexed: false },
      { name: "requestExpiry", type: "uint40", indexed: false },
    ],
  },
  {
    name: "RequestExpired",
    type: "event",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "escrowReturned", type: "uint256", indexed: false },
    ],
  },
] as const;
```

---

## 7. Unit Test Checklist

Every test must pass before contracts are locked on Day 2.

### CertificateRegistry

- [ ] `mintCertificate` succeeds with authorized issuer, returns non-zero `tokenId`
- [ ] `mintCertificate` reverts with unauthorized caller (`"Not authorized"`)
- [ ] `mintCertificate` reverts if cert already exists for same owner + attrKey and is not revoked
- [ ] `locked(tokenId)` returns `true`
- [ ] `transferFrom` reverts (`"Soulbound: non-transferable"`)
- [ ] `safeTransferFrom` reverts (`"Soulbound: non-transferable"`)
- [ ] `revokeCertificate` sets `revoked = true`, emits `CertificateRevoked`
- [ ] `revokeCertificate` reverts if already revoked
- [ ] `isValid` returns `true` for live cert, `false` for revoked cert
- [ ] `getTokenId` returns `0` for unknown owner + attrKey
- [ ] `ownerAttrToken` mapping updates correctly on mint
- [ ] `keccak256("defi_user")` used as `attrKey` stores and retrieves correctly

### LeaseManager

- [ ] `postRequest` stores request, holds ETH, emits `RequestPosted`
- [ ] `postRequest` reverts if `msg.value != pricePerUser * maxUsers`
- [ ] `postRequest` reverts if `maxUsers == 0`
- [ ] `approveLease` creates lease, earmarks payment (does NOT transfer yet), emits `LeaseApproved`
- [ ] `approveLease` reverts if certificate is revoked
- [ ] `approveLease` reverts if `confidenceLevel < minConfidence`
- [ ] `approveLease` reverts if cert is AI-derived and `aiAllowed == false`
- [ ] `approveLease` reverts if same user tries to fill same request twice
- [ ] `approveLease` reverts if `filledCount >= maxUsers`
- [ ] `approveLease` reverts if request has expired
- [ ] `settleLease` transfers ETH to user after `expiresAt`, emits `LeaseSettled`
- [ ] `settleLease` reverts if called before `expiresAt`
- [ ] `settleLease` reverts if `status != Active`
- [ ] `revokeLease` sets `status = Revoked`, does NOT transfer ETH, emits `LeaseRevoked`
- [ ] `revokeLease` reverts if `msg.sender != lease.user`
- [ ] `revokeLease` reverts if `status != Active`
- [ ] `withdrawUnfilledEscrow` returns ETH to buyer after `requestExpiry`
- [ ] `withdrawUnfilledEscrow` reverts before `requestExpiry`
- [ ] `withdrawUnfilledEscrow` reverts if caller is not buyer
- [ ] `nonReentrant` guard prevents re-entrancy on `approveLease`, `settleLease`, `revokeLease`

### Cross-Contract

- [ ] `approveLease` calls `CertificateRegistry.isValid()` and correctly rejects revoked cert
- [ ] `attributeKey` hash from TypeScript `ATTRIBUTE_KEYS` matches `keccak256("defi_user")` in Solidity

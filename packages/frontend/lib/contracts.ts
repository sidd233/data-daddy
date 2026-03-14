export const CERTIFICATE_REGISTRY_ADDRESS = process.env
  .NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS as `0x${string}`;

export const LEASE_MANAGER_ADDRESS = process.env
  .NEXT_PUBLIC_LEASE_MANAGER_ADDRESS as `0x${string}`;

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
    name: "getCertificate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
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
    name: "isValid",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
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
    name: "RequestPosted",
    type: "event",
    inputs: [
      { name: "requestId",     type: "uint256", indexed: true },
      { name: "buyer",         type: "address", indexed: true },
      { name: "attrKey",       type: "bytes32", indexed: true },
      { name: "pricePerUser",  type: "uint256", indexed: false },
      { name: "maxUsers",      type: "uint256", indexed: false },
      { name: "requestExpiry", type: "uint40",  indexed: false },
    ],
  },
  {
    name: "LeaseApproved",
    type: "event",
    inputs: [
      { name: "leaseId",    type: "uint256", indexed: true },
      { name: "requestId",  type: "uint256", indexed: true },
      { name: "user",       type: "address", indexed: true },
      { name: "attrKey",    type: "bytes32", indexed: false },
      { name: "confidence", type: "uint8",   indexed: false },
      { name: "expiresAt",  type: "uint40",  indexed: false },
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
] as const;

export const CERTIFICATE_REGISTRY = {
  address: CERTIFICATE_REGISTRY_ADDRESS,
  abi: CERTIFICATE_REGISTRY_ABI,
} as const;

export const LEASE_MANAGER = {
  address: LEASE_MANAGER_ADDRESS,
  abi: LEASE_MANAGER_ABI,
} as const;

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

export const ATTRIBUTE_LABELS: Record<keyof typeof ATTRIBUTE_KEYS, string> = {
  defi_user:          "DeFi User",
  asset_holder:       "Asset Holder",
  active_wallet:      "Active Wallet",
  long_term_holder:   "Long-Term Holder",
  nft_holder:         "NFT Holder",
  age_range:          "Age Range (ZK)",
  state_of_residence: "State of Residence (ZK)",
};

export const ATTRIBUTE_TIERS: Record<keyof typeof ATTRIBUTE_KEYS, 1 | 2> = {
  defi_user:          1,
  asset_holder:       1,
  active_wallet:      1,
  long_term_holder:   1,
  nft_holder:         1,
  age_range:          2,
  state_of_residence: 2,
};

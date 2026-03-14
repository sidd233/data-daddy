import { AnonAadhaarProvider } from "./providers/anon-aadhaar";

const providers = {
  anon_aadhaar: new AnonAadhaarProvider(),
  // gitcoin_passport: stub — not enabled
} as const;

export type ProviderKey = keyof typeof providers;

export function getZKProvider(providerKey: string) {
  const provider = providers[providerKey as ProviderKey];
  if (!provider) throw new Error(`Unknown ZK provider: ${providerKey}`);
  return provider;
}

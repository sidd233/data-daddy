// Prevents TypeScript from type-checking @anon-aadhaar/core source files.
// The package ships raw .ts files which break strict checking.
// Runtime behaviour is unchanged — this is a type declaration stub only.
declare module "@anon-aadhaar/core" {
  export const verify: (pcd: unknown, useTestAadhaar?: boolean) => Promise<boolean>
  export const deserialize: (serialized: string) => Promise<unknown>
  export const prove: (...args: unknown[]) => Promise<unknown>
  export const init: (...args: unknown[]) => Promise<void>
  export const AnonAadhaarCore: unknown
  export const testPublicKeyHash: string
  export const productionPublicKeyHash: string
}

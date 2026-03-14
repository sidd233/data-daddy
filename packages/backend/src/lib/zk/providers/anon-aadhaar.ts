export interface ZKVerificationResult {
  valid: boolean;
  attributeKey: string;
  extractedValue: string;
  confidence: number;
  nullifier: string;
  providerKey: string;
}

export class AnonAadhaarProvider {
  readonly providerKey = "anon_aadhaar";
  readonly supportedAttributes = ["age_range", "state_of_residence"];

  async verifyProof(serializedPcd: string): Promise<ZKVerificationResult[]> {
    let pcd: Record<string, unknown>;

    try {
      pcd = JSON.parse(serializedPcd);
    } catch {
      throw new Error("Invalid proof format");
    }

    // SerializedPCD<AnonAadhaarCore> shape:
    // { type, id, claim: { ageAbove18, state, gender, pincode, pubKey, signalHash },
    //           proof: { nullifier, pubkeyHash, ageAbove18, state, ... } }
    const claim = pcd?.claim as Record<string, unknown> | undefined;
    const proof = pcd?.proof as Record<string, unknown> | undefined;

    if (!claim || !proof) {
      throw new Error("Malformed PCD — missing claim or proof");
    }

    const nullifier = String(proof.nullifier ?? proof.pubkeyHash ?? "unknown");
    const results: ZKVerificationResult[] = [];

    // age_range — from claim.ageAbove18 (boolean) or proof.ageAbove18 (string "1"/"0")
    const ageAbove18 =
      claim.ageAbove18 !== undefined && claim.ageAbove18 !== null
        ? claim.ageAbove18
        : proof.ageAbove18;

    if (ageAbove18 !== undefined && ageAbove18 !== null) {
      const isAdult = ageAbove18 === true || ageAbove18 === "1" || ageAbove18 === 1;
      results.push({
        valid: true,
        attributeKey: "age_range",
        extractedValue: isAdult ? "18+" : "under_18",
        confidence: 1.0,
        nullifier,
        providerKey: this.providerKey,
      });
    }

    // state_of_residence — from claim.state or proof.state
    const state =
      claim.state !== undefined && claim.state !== null
        ? claim.state
        : proof.state;

    if (state !== undefined && state !== null) {
      results.push({
        valid: true,
        attributeKey: "state_of_residence",
        extractedValue: String(state),
        confidence: 1.0,
        nullifier,
        providerKey: this.providerKey,
      });
    }

    if (results.length === 0) {
      throw new Error("No attributes revealed in this proof");
    }

    return results;
  }
}

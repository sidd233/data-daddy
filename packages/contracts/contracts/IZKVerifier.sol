// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IZKVerifier {
    /// @param proof    ABI- or provider-encoded proof bytes. The internal
    ///                 structure (e.g. Groth16 π_A/π_B/π_C, PLONK transcript,
    ///                 Reclaim signed claim) is opaque to this interface.
    /// @param context  Provider-specific auxiliary data required for
    ///                 verification: nullifier seed, application ID, public
    ///                 signals, merkle root snapshot, etc.
    ///
    /// @return valid         `true` iff the proof cryptographically verifies
    ///                       against the verification key held by this adapter.
    /// @return attributeKey  keccak256 hash of the attribute this proof
    ///                       attests to (e.g. keccak256("PROOF_OF_HUMANITY")).
    ///                       MUST be bytes32(0) when `valid` is `false`.
    /// @return confidence    Attestation confidence in the range [0, 100].
    ///                       MUST be 100 whenever `valid` is `true`.
    ///                       MUST be 0 whenever `valid` is `false`.
    function verifyProof(
        bytes calldata proof,
        bytes calldata context
    )
        external
        view
        returns (
            bool     valid,
            bytes32  attributeKey,
            uint8    confidence
        );
}

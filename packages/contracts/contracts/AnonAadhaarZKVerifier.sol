// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./IZKVerifier.sol";

/// @dev Minimal interface for the deployed AnonAadhaar verifier contract.
///      Deployed on Ethereum Sepolia: 0x6375394335f34848b850114b66A49D6F47f2cdA8
interface IAnonAadhaar {
    function verifyAnonAadhaarProof(
        uint256 nullifierSeed,
        uint256 nullifier,
        uint256 timestamp,
        uint256 signal,
        uint256[4] calldata revealArray,
        uint256[8] calldata groth16Proof
    ) external view returns (bool);
}

contract AnonAadhaarZKVerifier is IZKVerifier {

    /// @notice The upstream AnonAadhaar verifier this adapter delegates to.
    IAnonAadhaar public immutable anonAadhaarVerifier;

    /// @notice The attributeKey returned on a valid proof.
    ///         = keccak256("PROOF_OF_AADHAAR")
    bytes32 public constant ATTRIBUTE_KEY = keccak256("PROOF_OF_AADHAAR");

    /// @param _verifier Address of the deployed AnonAadhaar verifier contract.
    constructor(address _verifier) {
        require(_verifier != address(0), "Zero address");
        anonAadhaarVerifier = IAnonAadhaar(_verifier);
    }

    /// @inheritdoc IZKVerifier
    function verifyProof(
        bytes calldata proof,
        bytes calldata context
    )
        external
        view
        override
        returns (bool valid, bytes32 attributeKey, uint8 confidence)
    {
        // --- 1. Decode the Groth16 proof scalars from `proof` ---
        uint256[8] memory groth16Proof = abi.decode(proof, (uint256[8]));

        // --- 2. Decode the public inputs from `context` ---
        (
            uint256 nullifierSeed,
            uint256 nullifier,
            uint256 timestamp,
            uint256 signal,
            uint256[4] memory revealArray
        ) = abi.decode(context, (uint256, uint256, uint256, uint256, uint256[4]));

        // --- 3. Delegate to the upstream verifier ---
        bool result = anonAadhaarVerifier.verifyAnonAadhaarProof(
            nullifierSeed,
            nullifier,
            timestamp,
            signal,
            revealArray,
            groth16Proof
        );

        // --- 4. Normalise into IZKVerifier return format ---
        if (result) {
            return (true, ATTRIBUTE_KEY, 100);
        } else {
            return (false, bytes32(0), 0);
        }
    }
}

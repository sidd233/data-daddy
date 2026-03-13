// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title  ICertificateRegistry
/// @notice Minimal interface for CertificateRegistry consumed by LeaseManager.
/// @dev    Struct layout and function signatures must stay in sync with
///         CertificateRegistry.sol. Ownership is tracked by ERC-721 (`ownerOf`),
///         not by a field inside the Certificate struct.
interface ICertificateRegistry {
    /// @dev Mirrors CertificateRegistry.Certificate exactly.
    ///      Note: there is no `owner` or `aiDerived` field — ownership is
    ///      queried via `ownerOf`, and AI-tier detection is done by comparing
    ///      `issuer` against the known `aiIssuerAddress` in LeaseManager.
    struct Certificate {
        bytes32 attributeKey;
        uint8   confidenceLevel;
        uint40  issuedAt;
        uint40  expiresAt;
        address issuer;
        bool    revoked;
    }

    /// @notice Returns true when `tokenId` exists, is not revoked, and not expired.
    function isValid(uint256 tokenId) external view returns (bool);

    /// @notice Returns the Certificate struct for an existing token.
    ///         Reverts if the token does not exist.
    function getCertificate(uint256 tokenId) external view returns (Certificate memory);

    /// @notice Returns the current owner of `tokenId` (ERC-721).
    ///         Reverts if the token does not exist.
    function ownerOf(uint256 tokenId) external view returns (address);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC5192 {
    /// @notice Emitted when a token is locked.
    event Locked(uint256 tokenId);

    /// @notice Emitted when a token is unlocked.
    event Unlocked(uint256 tokenId);

    /// @notice Returns true if the token is locked.
    function locked(uint256 tokenId) external view returns (bool);
}

contract CertificateRegistry is ERC721, Ownable, IERC5192 {
    struct Certificate {
        bytes32 attributeKey;
        uint8 confidenceLevel;
        uint40 issuedAt;
        uint40 expiresAt;
        address issuer;
        bool revoked;
    }

    mapping(uint256 tokenId => Certificate) public certificates;
    mapping(address owner => mapping(bytes32 attrKey => uint256 tokenId))
        public ownerAttrToken;
    mapping(address => bool) public authorizedIssuers;
    uint256 private _tokenIdCounter;

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

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized");
        _;
    }

    constructor() ERC721("Meridian Certificate", "MRCERT") Ownable(msg.sender) {
        _tokenIdCounter = 1;
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Allow minting (from == address(0))
        if (from != address(0)) {
            revert("Soulbound: non-transferable");
        }

        return from;
    }

    /// @notice Mints a new non-transferable certificate token to `owner`.
    /// @param owner Wallet receiving the certificate token.
    /// @param attributeKey Hashed attribute key, e.g. keccak256("age_range").
    /// @param confidenceLevel Confidence score from 0 to 100.
    /// @param expiresAt Unix timestamp when the certificate expires, or 0 for no expiry.
    /// @return tokenId Newly minted token ID.
    function mintCertificate(
        address owner,
        bytes32 attributeKey,
        uint8 confidenceLevel,
        uint40 expiresAt
    ) external onlyIssuer returns (uint256 tokenId) {
        require(owner != address(0), "Invalid owner");
        require(confidenceLevel <= 100, "Invalid confidence");
        require(
            expiresAt == 0 || expiresAt > block.timestamp,
            "Invalid expiry"
        );

        uint256 existingTokenId = ownerAttrToken[owner][attributeKey];
        if (existingTokenId != 0) {
            require(
                certificates[existingTokenId].revoked,
                "Cert already exists"
            );
        }

        tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;

        uint40 issuedAt = uint40(block.timestamp);

        certificates[tokenId] = Certificate({
            attributeKey: attributeKey,
            confidenceLevel: confidenceLevel,
            issuedAt: issuedAt,
            expiresAt: expiresAt,
            issuer: msg.sender,
            revoked: false
        });

        ownerAttrToken[owner][attributeKey] = tokenId;
        _mint(owner, tokenId);
        emit Locked(tokenId);

        emit CertificateMinted(
            tokenId,
            owner,
            attributeKey,
            confidenceLevel,
            issuedAt
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721) returns (bool) {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// @notice Marks an existing certificate as revoked.
    /// @param tokenId Token ID of the certificate to revoke.
    function revokeCertificate(uint256 tokenId) external onlyIssuer {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        Certificate storage cert = certificates[tokenId];
        require(!cert.revoked, "Already revoked");

        cert.revoked = true;
        emit CertificateRevoked(tokenId, ownerOf(tokenId), cert.attributeKey);
    }

    /// @notice Adds an issuer address authorized to mint and revoke certificates.
    /// @param issuer Issuer address to authorize.
    function addIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Removes issuer authorization from an address.
    /// @param issuer Issuer address to deauthorize.
    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice Returns whether tokens are locked as required by ERC-5192.
    /// @param tokenId Token ID (ignored; tokens are always locked).
    /// @return True for all token IDs.
    function locked(uint256 tokenId) external view override returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return true;
    }

    /// @notice Returns certificate data for an existing token.
    /// @param tokenId Token ID to query.
    /// @return Certificate struct for the token.
    function getCertificate(
        uint256 tokenId
    ) external view returns (Certificate memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return certificates[tokenId];
    }

    /// @notice Returns token ID for a given owner and attribute key pair.
    /// @param owner Wallet address.
    /// @param attributeKey Hashed attribute key.
    /// @return tokenId Token ID, or 0 if none exists.
    function getTokenId(
        address owner,
        bytes32 attributeKey
    ) external view returns (uint256 tokenId) {
        return ownerAttrToken[owner][attributeKey];
    }

    /// @notice Returns whether a certificate is currently valid.
    /// @param tokenId Token ID to validate.
    /// @return True if token exists, is not revoked, and not expired.
    function isValid(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) {
            return false;
        }

        Certificate memory cert = certificates[tokenId];
        if (cert.revoked) {
            return false;
        }

        if (cert.expiresAt == 0) {
            return true;
        }

        return block.timestamp < cert.expiresAt;
    }
}

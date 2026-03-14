// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "./CertificateRegistry.sol";

contract CertificateRegistryTest is Test {
    CertificateRegistry registry;

    address owner    = address(1);
    address issuer   = address(2);
    address user     = address(3);
    address attacker = address(4);
    address user2    = address(5);
    address issuer2  = address(6);

    bytes32 constant ATTR_AGE    = keccak256("age_range");
    bytes32 constant ATTR_INCOME = keccak256("income_range");

    // =========================================================
    // Setup
    // =========================================================

    function setUp() public {
        vm.prank(owner);
        registry = new CertificateRegistry();

        vm.prank(owner);
        registry.addIssuer(issuer);
    }

    // =========================================================
    // Helper
    // =========================================================

    /// Mints a basic certificate as issuer and returns the token ID.
    function _mintDefault() internal returns (uint256) {
        vm.prank(issuer);
        return registry.mintCertificate(user, ATTR_AGE, 90, 0);
    }

    // =========================================================
    // Deployment & Initial State
    // =========================================================

    function testOwnerIsSetOnDeploy() public view {
        assertEq(registry.owner(), owner);
    }

    function testIssuerIsAuthorizedAfterSetup() public view {
        assertTrue(registry.authorizedIssuers(issuer));
    }

    function testAttackerIsNotAuthorized() public view {
        assertFalse(registry.authorizedIssuers(attacker));
    }

    function testTokenCounterStartsAtOne() public {
        uint256 tokenId = _mintDefault();
        assertEq(tokenId, 1);
    }

    // =========================================================
    // Mint — Happy Path
    // =========================================================

    function testMintReturnsCorrectTokenId() public {
        uint256 tokenId = _mintDefault();
        assertEq(tokenId, 1);
    }

    function testMintAssignsOwnershipToUser() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.ownerOf(tokenId), user);
    }

    function testMintStoresAttributeKey() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.getCertificate(tokenId).attributeKey, ATTR_AGE);
    }

    function testMintStoresConfidenceLevel() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.getCertificate(tokenId).confidenceLevel, 90);
    }

    function testMintStoresIssuerAddress() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.getCertificate(tokenId).issuer, issuer);
    }

    function testMintSetsRevokedFalse() public {
        uint256 tokenId = _mintDefault();
        assertFalse(registry.getCertificate(tokenId).revoked);
    }

    function testMintSetsIssuedAtToBlockTimestamp() public {
        uint256 before = block.timestamp;
        uint256 tokenId = _mintDefault();
        assertEq(registry.getCertificate(tokenId).issuedAt, uint40(before));
    }

    function testMintWithNoExpirySetsExpiresAtZero() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.getCertificate(tokenId).expiresAt, 0);
    }

    function testMintWithExpiryStoresExpiry() public {
        uint40 expiry = uint40(block.timestamp + 7 days);
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 80, expiry);
        assertEq(registry.getCertificate(tokenId).expiresAt, expiry);
    }

    function testMintUpdatesOwnerAttrTokenMapping() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.getTokenId(user, ATTR_AGE), tokenId);
    }

    function testMintEmitsCertificateMintedEvent() public {
        vm.expectEmit(true, true, true, true);
        emit CertificateRegistry.CertificateMinted(
            1, user, ATTR_AGE, 90, uint40(block.timestamp)
        );
        vm.prank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 90, 0);
    }

    function testMintEmitsLockedEvent() public {
        vm.expectEmit(true, false, false, false);
        emit IERC5192.Locked(1);
        vm.prank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 90, 0);
    }

    function testTokenIdsIncrementAcrossMints() public {
        vm.startPrank(issuer);
        uint256 id1 = registry.mintCertificate(user,  ATTR_AGE,    90, 0);
        uint256 id2 = registry.mintCertificate(user2, ATTR_AGE,    80, 0);
        uint256 id3 = registry.mintCertificate(user,  ATTR_INCOME, 70, 0);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function testSameUserCanHoldMultipleDifferentAttributes() public {
        vm.startPrank(issuer);
        uint256 id1 = registry.mintCertificate(user, ATTR_AGE,    90, 0);
        uint256 id2 = registry.mintCertificate(user, ATTR_INCOME, 75, 0);
        vm.stopPrank();

        assertEq(registry.ownerOf(id1), user);
        assertEq(registry.ownerOf(id2), user);
        assertEq(registry.getTokenId(user, ATTR_AGE),    id1);
        assertEq(registry.getTokenId(user, ATTR_INCOME), id2);
    }

    function testDifferentUsersCanHoldSameAttribute() public {
        vm.startPrank(issuer);
        uint256 id1 = registry.mintCertificate(user,  ATTR_AGE, 90, 0);
        uint256 id2 = registry.mintCertificate(user2, ATTR_AGE, 85, 0);
        vm.stopPrank();

        assertEq(registry.ownerOf(id1), user);
        assertEq(registry.ownerOf(id2), user2);
    }

    function testMintAtMaxConfidence() public {
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 100, 0);
        assertEq(registry.getCertificate(tokenId).confidenceLevel, 100);
    }

    function testMintAtZeroConfidence() public {
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 0, 0);
        assertEq(registry.getCertificate(tokenId).confidenceLevel, 0);
    }

    // =========================================================
    // Mint — Input Validation
    // =========================================================

    function testMintRevertsForZeroAddress() public {
        vm.expectRevert("Invalid owner");
        vm.prank(issuer);
        registry.mintCertificate(address(0), ATTR_AGE, 90, 0);
    }

    function testMintRevertsForConfidenceOver100() public {
        vm.expectRevert("Invalid confidence");
        vm.prank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 101, 0);
    }

    function testMintRevertsForPastExpiry() public {
        // block.timestamp starts at 1 in Foundry, so timestamp - 1 = 0
        // which is the "no expiry" sentinel — warp forward first to get
        // a real past timestamp that won't be mistaken for "no expiry"
        vm.warp(1 days);
        uint40 pastExpiry = uint40(block.timestamp - 1);
        vm.expectRevert("Invalid expiry");
        vm.prank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 90, pastExpiry);
    }

    function testMintRevertsForExpiryEqualToBlockTimestamp() public {
        uint40 nowExpiry = uint40(block.timestamp);
        vm.expectRevert("Invalid expiry");
        vm.prank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 90, nowExpiry);
    }

    function testMintRevertsForUnauthorizedCaller() public {
        vm.expectRevert("Not authorized");
        vm.prank(attacker);
        registry.mintCertificate(user, ATTR_AGE, 90, 0);
    }

    function testMintRevertsForDuplicateActiveCertificate() public {
        vm.startPrank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 90, 0);
        vm.expectRevert("Cert already exists");
        registry.mintCertificate(user, ATTR_AGE, 95, 0);
        vm.stopPrank();
    }

    // =========================================================
    // Remint After Revocation
    // =========================================================

    function testRemintAfterRevocationSucceeds() public {
        vm.startPrank(issuer);
        uint256 oldId = registry.mintCertificate(user, ATTR_AGE, 90, 0);
        registry.revokeCertificate(oldId);
        uint256 newId = registry.mintCertificate(user, ATTR_AGE, 95, 0);
        vm.stopPrank();

        assertTrue(newId > oldId);
        assertFalse(registry.getCertificate(newId).revoked);
        assertTrue(registry.isValid(newId));
    }

    function testRemintUpdatesOwnerAttrTokenMapping() public {
        vm.startPrank(issuer);
        uint256 oldId = registry.mintCertificate(user, ATTR_AGE, 90, 0);
        registry.revokeCertificate(oldId);
        uint256 newId = registry.mintCertificate(user, ATTR_AGE, 95, 0);
        vm.stopPrank();

        // mapping now points to the new token
        assertEq(registry.getTokenId(user, ATTR_AGE), newId);
    }

    function testRemintOldCertStillRevoked() public {
        vm.startPrank(issuer);
        uint256 oldId = registry.mintCertificate(user, ATTR_AGE, 90, 0);
        registry.revokeCertificate(oldId);
        registry.mintCertificate(user, ATTR_AGE, 95, 0);
        vm.stopPrank();

        assertTrue(registry.getCertificate(oldId).revoked);
        assertFalse(registry.isValid(oldId));
    }

    // =========================================================
    // Revocation
    // =========================================================

    function testRevokeSetsFlagToTrue() public {
        uint256 tokenId = _mintDefault();
        vm.prank(issuer);
        registry.revokeCertificate(tokenId);
        assertTrue(registry.getCertificate(tokenId).revoked);
    }

    function testRevokeInvalidatesIsValid() public {
        uint256 tokenId = _mintDefault();
        vm.prank(issuer);
        registry.revokeCertificate(tokenId);
        assertFalse(registry.isValid(tokenId));
    }

    function testRevokeDoesNotBurnToken() public {
        uint256 tokenId = _mintDefault();
        vm.prank(issuer);
        registry.revokeCertificate(tokenId);
        // token still exists in the wallet
        assertEq(registry.ownerOf(tokenId), user);
    }

    function testRevokeEmitsCertificateRevokedEvent() public {
        uint256 tokenId = _mintDefault();
        vm.expectEmit(true, true, true, false);
        emit CertificateRegistry.CertificateRevoked(tokenId, user, ATTR_AGE);
        vm.prank(issuer);
        registry.revokeCertificate(tokenId);
    }

    function testDoubleRevokeReverts() public {
        uint256 tokenId = _mintDefault();
        vm.startPrank(issuer);
        registry.revokeCertificate(tokenId);
        vm.expectRevert("Already revoked");
        registry.revokeCertificate(tokenId);
        vm.stopPrank();
    }

    function testRevokeByUnauthorizedReverts() public {
        uint256 tokenId = _mintDefault();
        vm.expectRevert("Not authorized");
        vm.prank(attacker);
        registry.revokeCertificate(tokenId);
    }

    function testRevokeNonExistentTokenReverts() public {
        vm.expectRevert("Token does not exist");
        vm.prank(issuer);
        registry.revokeCertificate(9999);
    }

    // =========================================================
    // Expiry Logic
    // =========================================================

    function testValidBeforeExpiry() public {
        uint40 expiry = uint40(block.timestamp + 1 days);
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 90, expiry);
        assertTrue(registry.isValid(tokenId));
    }

    function testInvalidAfterExpiry() public {
        uint40 expiry = uint40(block.timestamp + 1 days);
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 90, expiry);

        vm.warp(block.timestamp + 2 days);
        assertFalse(registry.isValid(tokenId));
    }

    function testInvalidAtExactExpiryTimestamp() public {
        uint40 expiry = uint40(block.timestamp + 1 days);
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 90, expiry);

        vm.warp(expiry); // exactly at expiry — should be invalid
        assertFalse(registry.isValid(tokenId));
    }

    function testNoExpiryIsAlwaysValid() public {
        uint256 tokenId = _mintDefault(); // expiresAt = 0
        vm.warp(block.timestamp + 365 days * 100); // 100 years later
        assertTrue(registry.isValid(tokenId));
    }

    function testRevokedCertInvalidEvenBeforeExpiry() public {
        uint40 expiry = uint40(block.timestamp + 30 days);
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 90, expiry);

        vm.prank(issuer);
        registry.revokeCertificate(tokenId);

        // still well before expiry but revoked
        assertFalse(registry.isValid(tokenId));
    }

    // =========================================================
    // isValid — Edge Cases
    // =========================================================

    function testIsValidReturnsFalseForNonExistentToken() public view {
        assertFalse(registry.isValid(9999));
    }

    // =========================================================
    // Soulbound — Transfer Prevention
    // =========================================================

    function testTransferFromReverts() public {
        uint256 tokenId = _mintDefault();
        vm.expectRevert("Soulbound: non-transferable");
        vm.prank(user);
        registry.transferFrom(user, attacker, tokenId);
    }

    function testSafeTransferFromReverts() public {
        uint256 tokenId = _mintDefault();
        vm.expectRevert("Soulbound: non-transferable");
        vm.prank(user);
        registry.safeTransferFrom(user, attacker, tokenId);
    }

    function testApprovedTransferStillReverts() public {
        uint256 tokenId = _mintDefault();
        vm.prank(user);
        registry.approve(attacker, tokenId);

        vm.expectRevert("Soulbound: non-transferable");
        vm.prank(attacker);
        registry.transferFrom(user, attacker, tokenId);
    }

    // =========================================================
    // Issuer Management
    // =========================================================

    function testAddIssuerAuthorizes() public {
        vm.prank(owner);
        registry.addIssuer(issuer2);
        assertTrue(registry.authorizedIssuers(issuer2));
    }

    function testAddIssuerEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit CertificateRegistry.IssuerAdded(issuer2);
        vm.prank(owner);
        registry.addIssuer(issuer2);
    }

    function testNewIssuerCanMint() public {
        vm.prank(owner);
        registry.addIssuer(issuer2);

        vm.prank(issuer2);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 80, 0);
        assertEq(registry.ownerOf(tokenId), user);
    }

    function testRemoveIssuerDeauthorizes() public {
        vm.prank(owner);
        registry.removeIssuer(issuer);
        assertFalse(registry.authorizedIssuers(issuer));
    }

    function testRemoveIssuerEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit CertificateRegistry.IssuerRemoved(issuer);
        vm.prank(owner);
        registry.removeIssuer(issuer);
    }

    function testRemovedIssuerCannotMint() public {
        vm.prank(owner);
        registry.removeIssuer(issuer);

        vm.expectRevert("Not authorized");
        vm.prank(issuer);
        registry.mintCertificate(user, ATTR_AGE, 90, 0);
    }

    function testRemovedIssuerCannotRevoke() public {
        uint256 tokenId = _mintDefault();

        vm.prank(owner);
        registry.removeIssuer(issuer);

        vm.expectRevert("Not authorized");
        vm.prank(issuer);
        registry.revokeCertificate(tokenId);
    }

    function testNonOwnerCannotAddIssuer() public {
        vm.expectRevert();
        vm.prank(attacker);
        registry.addIssuer(attacker);
    }

    function testNonOwnerCannotRemoveIssuer() public {
        vm.expectRevert();
        vm.prank(attacker);
        registry.removeIssuer(issuer);
    }

    // =========================================================
    // Read Functions
    // =========================================================

    function testGetCertificateReturnsCorrectData() public {
        uint40 expiry = uint40(block.timestamp + 7 days);
        vm.prank(issuer);
        uint256 tokenId = registry.mintCertificate(user, ATTR_AGE, 85, expiry);

        CertificateRegistry.Certificate memory cert = registry.getCertificate(tokenId);
        assertEq(cert.attributeKey,    ATTR_AGE);
        assertEq(cert.confidenceLevel, 85);
        assertEq(cert.expiresAt,       expiry);
        assertEq(cert.issuer,          issuer);
        assertFalse(cert.revoked);
    }

    function testGetCertificateRevertsForNonExistentToken() public {
        vm.expectRevert("Token does not exist");
        registry.getCertificate(9999);
    }

    function testGetTokenIdReturnsCorrectId() public {
        uint256 tokenId = _mintDefault();
        assertEq(registry.getTokenId(user, ATTR_AGE), tokenId);
    }

    function testGetTokenIdReturnsZeroWhenNoneExists() public view {
        assertEq(registry.getTokenId(user, ATTR_AGE), 0);
    }

    function testGetTokenIdReturnsZeroForWrongAttribute() public {
        _mintDefault(); // mints ATTR_AGE
        assertEq(registry.getTokenId(user, ATTR_INCOME), 0);
    }

    function testGetTokenIdReturnsZeroForWrongUser() public {
        _mintDefault(); // mints for `user`
        assertEq(registry.getTokenId(user2, ATTR_AGE), 0);
    }

    // =========================================================
    // ERC-5192 Compliance
    // =========================================================

    function testLockedReturnsTrueForValidToken() public {
        uint256 tokenId = _mintDefault();
        assertTrue(registry.locked(tokenId));
    }

    function testLockedReturnsTrueForRevokedToken() public {
        uint256 tokenId = _mintDefault();
        vm.prank(issuer);
        registry.revokeCertificate(tokenId);
        assertTrue(registry.locked(tokenId)); // still locked even when revoked
    }

    function testLockedRevertsForNonExistentToken() public {
        vm.expectRevert("Token does not exist");
        registry.locked(9999);
    }

    function testSupportsERC5192Interface() public view {
        assertTrue(registry.supportsInterface(type(IERC5192).interfaceId));
    }

    function testSupportsERC721Interface() public view {
        bytes4 erc721Id = 0x80ac58cd;
        assertTrue(registry.supportsInterface(erc721Id));
    }

    function testDoesNotSupportRandomInterface() public view {
        assertFalse(registry.supportsInterface(0xdeadbeef));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ICertificateRegistry.sol";

contract LeaseManager is ReentrancyGuard, Ownable {

    // ─────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────

    enum LeaseStatus {
        Active,
        Settled,
        Revoked
    }

    // ─────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────

    struct LeaseRequest {
        address buyer;
        bytes32 attributeKey;
        uint8 minConfidence;
        bool aiAllowed;
        uint256 pricePerUser;
        uint40 leaseDurationSec;
        uint40 requestExpiry;
        uint256 escrowBalance;
        uint256 maxUsers;
        uint256 filledCount;
        bool active;
    }

    struct Lease {
        uint256 requestId;
        address user;
        uint256 certificateTokenId;
        LeaseStatus status;
        uint40 startedAt;
        uint40 expiresAt;
        uint256 paidAmount;
    }

    // ─────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────

    mapping(uint256 => LeaseRequest) public leaseRequests;
    mapping(uint256 => Lease) public leases;
    mapping(uint256 => mapping(address => bool)) public requestFilledByUser;

    uint256 private _requestIdCounter;
    uint256 private _leaseIdCounter;

    address public certificateRegistry;
    address public aiIssuerAddress;

    // ─────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────

    event RequestPosted(
        uint256 indexed requestId,
        address indexed buyer,
        bytes32 indexed attrKey,
        uint256 pricePerUser,
        uint256 maxUsers,
        uint40 requestExpiry
    );

    event LeaseApproved(
        uint256 indexed leaseId,
        uint256 indexed requestId,
        address indexed user,
        bytes32 attrKey,
        uint8 confidence,
        uint40 expiresAt
    );

    event LeaseSettled(
        uint256 indexed leaseId,
        address indexed user,
        uint256 amount
    );

    event LeaseRevoked(
        uint256 indexed leaseId,
        uint256 indexed requestId,
        address indexed user
    );

    event RequestExpired(
        uint256 indexed requestId,
        address indexed buyer,
        uint256 escrowReturned
    );

    // ─────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────

    function setCertificateRegistry(address registry) external onlyOwner {
        require(registry != address(0), "Zero address");
        require(certificateRegistry == address(0), "Already set");
        certificateRegistry = registry;
    }

    function setAiIssuerAddress(address issuer) external onlyOwner {
        require(issuer != address(0), "Zero address");
        aiIssuerAddress = issuer;
    }

    // ─────────────────────────────────────────────────────────
    // Buyer Functions
    // ─────────────────────────────────────────────────────────

    function postRequest(
        bytes32 attrKey,
        uint8 minConf,
        bool aiAllowed,
        uint256 pricePerUser,
        uint40 duration,
        uint40 reqExpiry,
        uint256 maxUsers
    )
        external
        payable
        returns (uint256 requestId)
    {
        require(maxUsers > 0, "maxUsers must be > 0");
        require(pricePerUser > 0, "pricePerUser must be > 0");
        require(duration > 0, "Duration must be > 0");
        require(reqExpiry > block.timestamp, "Request already expired");
        require(msg.value == pricePerUser * maxUsers, "Incorrect escrow amount");

        requestId = ++_requestIdCounter;

        leaseRequests[requestId] = LeaseRequest({
            buyer: msg.sender,
            attributeKey: attrKey,
            minConfidence: minConf,
            aiAllowed: aiAllowed,
            pricePerUser: pricePerUser,
            leaseDurationSec: duration,
            requestExpiry: reqExpiry,
            escrowBalance: msg.value,
            maxUsers: maxUsers,
            filledCount: 0,
            active: true
        });

        emit RequestPosted(
            requestId,
            msg.sender,
            attrKey,
            pricePerUser,
            maxUsers,
            reqExpiry
        );
    }

    function withdrawUnfilledEscrow(uint256 requestId)
        external
        nonReentrant
    {
        LeaseRequest storage req = leaseRequests[requestId];

        require(msg.sender == req.buyer, "Not request owner");
        require(block.timestamp > req.requestExpiry, "Request not yet expired");
        require(req.escrowBalance > 0, "No escrow to withdraw");

        uint256 amount = req.escrowBalance;

        req.escrowBalance = 0;
        req.active = false;

        emit RequestExpired(requestId, msg.sender, amount);

        (bool sent,) = payable(msg.sender).call{value: amount}("");
        require(sent, "ETH transfer failed");
    }

    // ─────────────────────────────────────────────────────────
    // User Functions
    // ─────────────────────────────────────────────────────────

    function approveLease(
        uint256 requestId,
        uint256 certificateTokenId
    )
        external
        nonReentrant
        returns (uint256 leaseId)
    {
        require(certificateRegistry != address(0), "Registry not set");

        LeaseRequest storage req = leaseRequests[requestId];

        // 1
        require(req.buyer != address(0), "Request does not exist");

        // 2
        require(req.active, "Request not active");

        // 3
        if (block.timestamp > req.requestExpiry) {
            req.active = false;
            revert("Request expired");
        }

        ICertificateRegistry registry = ICertificateRegistry(certificateRegistry);

        // 4
        require(registry.isValid(certificateTokenId), "Certificate invalid or revoked");

        ICertificateRegistry.Certificate memory cert =
            registry.getCertificate(certificateTokenId);

        // 5
        require(registry.ownerOf(certificateTokenId) == msg.sender, "Not certificate owner");

        // 6
        require(cert.attributeKey == req.attributeKey, "Attribute mismatch");

        // 7
        require(cert.confidenceLevel >= req.minConfidence, "Confidence too low");

        // 8
        if (cert.issuer == aiIssuerAddress) {
            require(req.aiAllowed, "AI certs not accepted");
        }

        // 9
        require(!requestFilledByUser[requestId][msg.sender], "Already approved");

        // 10
        require(req.filledCount < req.maxUsers, "Request fully filled");

        leaseId = ++_leaseIdCounter;

        uint40 startedAt = uint40(block.timestamp);
        uint40 expiresAt = startedAt + req.leaseDurationSec;

        leases[leaseId] = Lease({
            requestId: requestId,
            user: msg.sender,
            certificateTokenId: certificateTokenId,
            status: LeaseStatus.Active,
            startedAt: startedAt,
            expiresAt: expiresAt,
            paidAmount: req.pricePerUser
        });

        req.escrowBalance -= req.pricePerUser;

        requestFilledByUser[requestId][msg.sender] = true;

        req.filledCount += 1;

        if (req.filledCount == req.maxUsers) {
            req.active = false;
        }

        emit LeaseApproved(
            leaseId,
            requestId,
            msg.sender,
            req.attributeKey,
            cert.confidenceLevel,
            expiresAt
        );
    }

    function settleLease(uint256 leaseId)
        external
        nonReentrant
    {
        Lease storage lease = leases[leaseId];

        require(lease.status == LeaseStatus.Active, "Lease not active");
        require(block.timestamp >= lease.expiresAt, "Lease not yet expired");

        lease.status = LeaseStatus.Settled;

        uint256 amount = lease.paidAmount;
        address user = lease.user;

        emit LeaseSettled(leaseId, user, amount);

        (bool sent,) = payable(user).call{value: amount}("");
        require(sent, "ETH transfer failed");
    }

    function revokeLease(uint256 leaseId)
        external
        nonReentrant
    {
        Lease storage lease = leases[leaseId];

        require(msg.sender == lease.user, "Not lease owner");
        require(lease.status == LeaseStatus.Active, "Lease not active");

        lease.status = LeaseStatus.Revoked;

        emit LeaseRevoked(leaseId, lease.requestId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // Read Helpers
    // ─────────────────────────────────────────────────────────

    function getRequest(uint256 requestId)
        external
        view
        returns (LeaseRequest memory)
    {
        return leaseRequests[requestId];
    }

    function getLease(uint256 leaseId)
        external
        view
        returns (Lease memory)
    {
        return leases[leaseId];
    }

    function hasUserFilledRequest(uint256 requestId, address user)
        external
        view
        returns (bool)
    {
        return requestFilledByUser[requestId][user];
    }
}
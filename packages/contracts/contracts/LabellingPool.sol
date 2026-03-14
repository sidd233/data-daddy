// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICertificateRegistry {
    function getTokenId(address owner, bytes32 attributeKey) external view returns (uint256);
    function isValid(uint256 tokenId) external view returns (bool);
}

/**
 * @title LabellingPool
 * @notice Schelling-point majority-vote labelling pool with stake slashing.
 *         Labellers stake ETH, vote on a label for a data item, winners split losers' stakes.
 */
contract LabellingPool is ReentrancyGuard, Ownable {

    // ── Storage ────────────────────────────────────────────────────────────────

    struct Task {
        uint256 stakeRequired;      // wei per labeller
        uint256 votingPeriodSec;    // seconds from task creation
        uint256 createdAt;          // unix timestamp
        bool exists;
    }

    struct LabelEntry {
        address labeller;
        string label;
        uint256 stakedAmount;
        bool settled;
    }

    struct DataItemResult {
        string winningLabel;
        uint256 totalLabellers;
        uint256 majorityCount;
        bool settled;
    }

    ICertificateRegistry public immutable certificateRegistry;

    // Known attribute keys for verifying labellers (7 standard attributes)
    bytes32[7] private _knownAttributeKeys;

    mapping(bytes32 => Task) public tasks;

    // taskId → dataId → entries
    mapping(bytes32 => mapping(bytes32 => LabelEntry[])) public labels;

    // taskId → dataId → result
    mapping(bytes32 => mapping(bytes32 => DataItemResult)) public results;

    // taskId → dataId → labeller → hasLabelled
    mapping(bytes32 => mapping(bytes32 => mapping(address => bool))) public hasLabelled;

    // ── Events ─────────────────────────────────────────────────────────────────

    event TaskCreated(bytes32 indexed taskId, uint256 stakeRequired, uint256 votingPeriodSec, uint256 createdAt);
    event LabelSubmitted(bytes32 indexed taskId, bytes32 indexed dataId, address indexed labeller, string label, uint256 staked);
    event TaskSettled(bytes32 indexed taskId, bytes32 indexed dataId, string winningLabel, uint256 totalLabellers, uint256 majorityCount);
    event StakeSlashed(bytes32 indexed taskId, bytes32 indexed dataId, address indexed labeller, uint256 amount);

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _certificateRegistry) Ownable(msg.sender) {
        certificateRegistry = ICertificateRegistry(_certificateRegistry);

        // Pre-compute known attribute keys (keccak256 of attribute name)
        _knownAttributeKeys[0] = keccak256(abi.encodePacked("defi_user"));
        _knownAttributeKeys[1] = keccak256(abi.encodePacked("asset_holder"));
        _knownAttributeKeys[2] = keccak256(abi.encodePacked("active_wallet"));
        _knownAttributeKeys[3] = keccak256(abi.encodePacked("long_term_holder"));
        _knownAttributeKeys[4] = keccak256(abi.encodePacked("nft_holder"));
        _knownAttributeKeys[5] = keccak256(abi.encodePacked("age_range"));
        _knownAttributeKeys[6] = keccak256(abi.encodePacked("state_of_residence"));
    }

    // ── Owner-only ─────────────────────────────────────────────────────────────

    /**
     * @notice Create a new labelling task. Called by backend owner wallet when a
     *         company's labelled request goes active.
     */
    function createTask(
        bytes32 taskId,
        uint256 stakeRequired,
        uint256 votingPeriodSec
    ) external onlyOwner {
        require(!tasks[taskId].exists, "Task already exists");
        require(stakeRequired > 0, "Stake must be > 0");
        require(votingPeriodSec > 0, "Voting period must be > 0");

        tasks[taskId] = Task({
            stakeRequired: stakeRequired,
            votingPeriodSec: votingPeriodSec,
            createdAt: block.timestamp,
            exists: true
        });

        emit TaskCreated(taskId, stakeRequired, votingPeriodSec, block.timestamp);
    }

    // ── Labeller actions ───────────────────────────────────────────────────────

    /**
     * @notice Submit a label for a data item. msg.value must equal task.stakeRequired.
     *         Labeller must hold a valid certificate from CertificateRegistry.
     */
    function stakeAndLabel(
        bytes32 taskId,
        bytes32 dataId,
        string calldata label
    ) external payable nonReentrant {
        Task storage task = tasks[taskId];
        require(task.exists, "Task does not exist");
        require(block.timestamp < task.createdAt + task.votingPeriodSec, "Voting period closed");
        require(!hasLabelled[taskId][dataId][msg.sender], "Already labelled");
        require(msg.value == task.stakeRequired, "Incorrect stake amount");
        require(labels[taskId][dataId].length < 50, "Max labellers reached");
        require(_isVerifiedUser(msg.sender), "Must hold valid certificate");
        require(bytes(label).length > 0, "Label cannot be empty");

        hasLabelled[taskId][dataId][msg.sender] = true;
        labels[taskId][dataId].push(LabelEntry({
            labeller: msg.sender,
            label: label,
            stakedAmount: msg.value,
            settled: false
        }));

        emit LabelSubmitted(taskId, dataId, msg.sender, label, msg.value);
    }

    // ── Permissionless settlement ──────────────────────────────────────────────

    /**
     * @notice Settle a data item after voting period ends.
     *         Tallies votes, finds majority label, redistributes stakes.
     *         Dust (rounding remainder) goes to owner.
     */
    function settle(bytes32 taskId, bytes32 dataId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.exists, "Task does not exist");
        require(block.timestamp >= task.createdAt + task.votingPeriodSec, "Voting period not ended");
        require(!results[taskId][dataId].settled, "Already settled");

        LabelEntry[] storage entries = labels[taskId][dataId];
        require(entries.length > 0, "No labels submitted");

        // Tally votes
        string memory winningLabel;
        uint256 winningCount = 0;

        // Find unique labels and count them (O(n²) — acceptable with max 50 entries)
        for (uint256 i = 0; i < entries.length; i++) {
            uint256 count = 0;
            for (uint256 j = 0; j < entries.length; j++) {
                if (keccak256(bytes(entries[i].label)) == keccak256(bytes(entries[j].label))) {
                    count++;
                }
            }
            if (count > winningCount) {
                winningCount = count;
                winningLabel = entries[i].label;
            }
        }

        // Record result
        results[taskId][dataId] = DataItemResult({
            winningLabel: winningLabel,
            totalLabellers: entries.length,
            majorityCount: winningCount,
            settled: true
        });

        // Redistribute stakes: collect loser stakes, distribute to winners
        uint256 loserStake = 0;
        uint256 winnerCount = 0;

        for (uint256 i = 0; i < entries.length; i++) {
            bool isWinner = keccak256(bytes(entries[i].label)) == keccak256(bytes(winningLabel));
            if (!isWinner) {
                loserStake += entries[i].stakedAmount;
                emit StakeSlashed(taskId, dataId, entries[i].labeller, entries[i].stakedAmount);
            } else {
                winnerCount++;
            }
            entries[i].settled = true;
        }

        // Return winner stakes + equal share of loser stakes
        if (winnerCount > 0 && loserStake > 0) {
            uint256 rewardPerWinner = loserStake / winnerCount;
            uint256 distributed = 0;

            for (uint256 i = 0; i < entries.length; i++) {
                if (keccak256(bytes(entries[i].label)) == keccak256(bytes(winningLabel))) {
                    uint256 payout = entries[i].stakedAmount + rewardPerWinner;
                    distributed += rewardPerWinner;
                    (bool ok,) = entries[i].labeller.call{value: payout}("");
                    require(ok, "Transfer failed");
                }
            }

            // Dust to owner
            uint256 dust = loserStake - distributed;
            if (dust > 0) {
                (bool ok,) = owner().call{value: dust}("");
                require(ok, "Dust transfer failed");
            }
        } else if (winnerCount > 0) {
            // No losers — just return stakes
            for (uint256 i = 0; i < entries.length; i++) {
                (bool ok,) = entries[i].labeller.call{value: entries[i].stakedAmount}("");
                require(ok, "Transfer failed");
            }
        }

        emit TaskSettled(taskId, dataId, winningLabel, entries.length, winningCount);
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getResult(bytes32 taskId, bytes32 dataId) external view returns (DataItemResult memory) {
        return results[taskId][dataId];
    }

    function getLabelCount(bytes32 taskId, bytes32 dataId) external view returns (uint256) {
        return labels[taskId][dataId].length;
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    /**
     * @notice Check if address holds at least one valid certificate from CertificateRegistry.
     */
    function _isVerifiedUser(address user) internal view returns (bool) {
        for (uint256 i = 0; i < _knownAttributeKeys.length; i++) {
            uint256 tokenId = certificateRegistry.getTokenId(user, _knownAttributeKeys[i]);
            if (tokenId != 0 && certificateRegistry.isValid(tokenId)) {
                return true;
            }
        }
        return false;
    }
}

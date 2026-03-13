// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./AnonAadhaarZKVerifier.sol";
import "./MockAnonAadhaar.sol";

contract AnonAadhaarZKVerifierTest {

    MockAnonAadhaar mock;
    AnonAadhaarZKVerifier verifier;

    function setUp() public {
        mock = new MockAnonAadhaar();
        verifier = new AnonAadhaarZKVerifier(address(mock));
    }

    function testValidProof() public view {

        uint256[8] memory groth;
        groth = [uint256(1),2,3,4,5,6,7,8];

        bytes memory proof = abi.encode(groth);

        uint256[4] memory reveal;
        reveal = [uint256(9),10,11,12];

        bytes memory context =
            abi.encode(uint256(1), uint256(2), uint256(3), uint256(4), reveal);

        (bool valid, bytes32 key, uint8 confidence) =
            verifier.verifyProof(proof, context);

        assert(valid);
        assert(confidence == 100);
        assert(key == keccak256("PROOF_OF_AADHAAR"));
    }

    function testInvalidProof() public {

        mock.setResult(false);

        uint256[8] memory groth;
        groth = [uint256(1),2,3,4,5,6,7,8];

        bytes memory proof = abi.encode(groth);

        uint256[4] memory reveal;
        reveal = [uint256(9),10,11,12];

        bytes memory context =
            abi.encode(uint256(1), uint256(2), uint256(3), uint256(4), reveal);

        (bool valid,,uint8 confidence) =
            verifier.verifyProof(proof, context);

        assert(!valid);
        assert(confidence == 0);
    }
}
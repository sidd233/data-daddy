// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockAnonAadhaar {

    bool public shouldVerify = true;

    function setResult(bool _result) external {
        shouldVerify = _result;
    }

    function verifyAnonAadhaarProof(
        uint256,
        uint256,
        uint256,
        uint256,
        uint256[4] calldata,
        uint256[8] calldata
    ) external view returns (bool) {
        return shouldVerify;
    }
}
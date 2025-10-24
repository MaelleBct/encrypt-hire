// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title EncryptedHireForm
 * @notice A simple FHE-enabled contract for collecting encrypted quiz answers
 *         from job applicants. Each applicant can submit only once.
 *         The answers should be encoded as a uint32 before encryption on client side.
 */
contract EncryptedHireForm is SepoliaConfig {
    /// @dev Keeps encrypted responses submitted by candidates.
    mapping(address => euint32) private _responses;

    /// @dev Marks which addresses have already submitted.
    mapping(address => bool) private _submitted;

    /**
     * @notice Upload encrypted quiz responses for hiring assessment.
     * @param encryptedData Encrypted quiz result (FHE-encrypted uint32).
     * @param zkProof Proof associated with the encrypted data.
     * @dev A wallet can send data only once.
     */
    function uploadResponse(externalEuint32 encryptedData, bytes calldata zkProof) external {
        require(!_submitted[msg.sender], "Response already exists");

        euint32 encValue = FHE.fromExternal(encryptedData, zkProof);
        _responses[msg.sender] = encValue;

        // Allow both candidate and this contract to decrypt later
        FHE.allow(encValue, msg.sender);
        FHE.allowThis(encValue);

        _submitted[msg.sender] = true;
    }

    /**
     * @notice Check if an address has already uploaded its encrypted response.
     * @param candidate Address of the candidate to verify.
     */
    function hasResponse(address candidate) external view returns (bool) {
        return _submitted[candidate];
    }

    /**
     * @notice Fetch encrypted quiz response of a given candidate.
     * @param candidate Address to query.
     * @return The stored encrypted response (`euint32`).
     */
    function viewEncryptedResponse(address candidate) external view returns (euint32) {
        return _responses[candidate];
    }
}

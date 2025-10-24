"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import {
  FhevmInstance,
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import { bigIntToString, stringToBigInt } from "~~/utils/helper/encoding";
import type { AllowedChainIds } from "~~/utils/helper/networks";

/**
 * @hook useEncryptedHireForm
 * @notice Manages encryption, decryption, and interaction with the EncryptHire contract.
 */
export const useEncryptedHireForm = ({
  instance,
  initialMockChains,
}: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } =
    useWagmiEthers(initialMockChains);

  const allowedChainId =
    typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: encryptHire } = useDeployedContractInfo({
    contractName: "EncryptedHireForm",
    chainId: allowedChainId,
  });

  type EncryptHireInfo = Contract<"EncryptedHireForm"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(encryptHire?.address && encryptHire?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(
      encryptHire!.address,
      (encryptHire as EncryptHireInfo).abi,
      providerOrSigner,
    );
  };

  // Fetch user's encrypted submission
  const { data: encryptedSubmission, refetch: refreshSubmission } = useReadContract({
    address: hasContract ? (encryptHire!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((encryptHire as EncryptHireInfo).abi as any) : undefined,
    functionName: "viewEncryptedResponse",
    args: [accounts?.[0] ?? ""],
    query: {
      enabled: !!(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const submissionHandle = useMemo(
    () => encryptedSubmission as string | undefined,
    [encryptedSubmission],
  );

  const hasSubmitted = useMemo(() => {
    return (
      Boolean(submissionHandle) &&
      submissionHandle !== ethers.ZeroHash &&
      submissionHandle !== "0x" &&
      submissionHandle !== "0x0"
    );
  }, [submissionHandle]);

  // Prepare FHE decryption
  const requests = useMemo(() => {
    if (!hasContract || !submissionHandle) return undefined;
    return [
      {
        handle: submissionHandle,
        contractAddress: encryptHire!.address,
      },
    ] as const;
  }, [hasContract, encryptHire?.address, submissionHandle]);

  const { decrypt, canDecrypt, isDecrypting, results, message: decMsg } =
    useFHEDecrypt({
      instance,
      ethersSigner: ethersSigner as any,
      fhevmDecryptionSignatureStorage,
      chainId,
      requests,
    });

  const [decryptedString, setDecryptedString] = useState<string>("");

  useEffect(() => {
    if (!results || Object.keys(results).length === 0) return;
    const handle = Object.keys(results)[0];
    const decryptedBigInt = results[handle];
    if (typeof decryptedBigInt === "bigint") {
      const text = bigIntToString(decryptedBigInt);
      setDecryptedString(text);
    }
  }, [results]);

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  // Encrypt user submission and send
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: encryptHire?.address,
  });

  const getEncryptionMethodFor = (functionName: "uploadResponse") => {
    const functionAbi = encryptHire?.abi.find(
      (item) => item.type === "function" && item.name === functionName,
    );
    if (!functionAbi) {
      return {
        method: undefined as string | undefined,
        error: `Function ABI not found for ${functionName}`,
      };
    }
    const firstInput = functionAbi.inputs?.[0];
    return { method: getEncryptionMethod(firstInput?.internalType), error: undefined };
  };

  const submitSubmission = useCallback(
    async (answerString: string) => {
      if (!answerString || isProcessing) return;
      setIsProcessing(true);
      setMessage(`Submitting encrypted answer "${answerString}"...`);
      try {
        const { method, error } = getEncryptionMethodFor("uploadResponse");
        if (!method) return setMessage(error ?? "Encryption method not found");

        const encoded = stringToBigInt(answerString);
        const enc = await encryptWith((builder) => (builder as any)[method](encoded));
        if (!enc) return setMessage("Encryption failed");

        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract not available");

        const params = buildParamsFromAbi(
          enc,
          [...encryptHire!.abi] as any[],
          "uploadResponse",
        );
        const tx = await writeContract.uploadResponse(...params, {
          gasLimit: 400_000,
        });
        await tx.wait();

        await refreshSubmission();
        setMessage("✅ Submission saved successfully!");
      } catch (err) {
        setMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [encryptWith, getContract, encryptHire?.abi, isProcessing],
  );

  return {
    submitSubmission,
    decrypt,
    canDecrypt,
    isDecrypting,
    message,
    isProcessing,
    decryptedString,
    hasSubmitted,
    submissionHandle,
    hasContract,
    hasSigner,
    chainId,
    accounts,
    isConnected,
  };
};

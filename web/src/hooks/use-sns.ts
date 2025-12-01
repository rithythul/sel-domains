"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient,
} from "wagmi";
import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  toHex,
  type Address,
} from "viem";
import {
  CONTRACT_ADDRESSES,
  SELRegistrarControllerABI,
  PublicResolverABI,
  ReverseRegistrarABI,
  BaseRegistrarABI,
  SNSRegistryABI,
} from "@/lib/contracts";
import {
  namehash,
  removeSuffix,
  SECONDS_PER_YEAR,
  MIN_COMMITMENT_AGE,
} from "@/lib/utils/namehash";

// ============ Types ============

export interface RegistrationParams {
  name: string;
  owner: Address;
  duration: bigint;
  secret: `0x${string}`;  // Secret MUST be provided by caller
  resolver?: Address;
  data?: `0x${string}`[];
  reverseRecord?: boolean;
}

export interface DomainInfo {
  name: string;
  labelhash: `0x${string}`;
  owner: Address;
  expires: bigint;
}

type RegistrationStep =
  | "idle"
  | "committing"
  | "waiting"
  | "registering"
  | "complete"
  | "error";

// ============ useCheckAvailability ============

/**
 * Check if a domain name is available for registration
 */
export function useCheckAvailability(name: string) {
  const nameWithoutSuffix = removeSuffix(name);
  const enabled = nameWithoutSuffix.length >= 3;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.SELRegistrarController,
    abi: SELRegistrarControllerABI,
    functionName: "available",
    args: [nameWithoutSuffix],
    query: {
      enabled,
    },
  });

  return {
    available: data ?? false,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useGetPrice ============

/**
 * Get the price for registering a domain
 */
export function useGetPrice(name: string, years: number) {
  const nameWithoutSuffix = removeSuffix(name);
  const duration = BigInt(years) * SECONDS_PER_YEAR;
  const enabled = nameWithoutSuffix.length >= 3 && years > 0;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.SELRegistrarController,
    abi: SELRegistrarControllerABI,
    functionName: "rentPrice",
    args: [nameWithoutSuffix, duration],
    query: {
      enabled,
    },
  });

  const [basePrice, premium] = data ?? [BigInt(0), BigInt(0)];

  return {
    basePrice,
    premium,
    total: basePrice + premium,
    duration,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useRegisterDomain ============

/**
 * Register a new domain using commit-reveal scheme
 */
export function useRegisterDomain() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Track the internal step for user-initiated transitions
  const [internalStep, setInternalStep] = useState<RegistrationStep>("idle");
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [commitment, setCommitment] = useState<`0x${string}` | null>(null);
  const [commitTimestamp, setCommitTimestamp] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [registrationParams, setRegistrationParams] =
    useState<RegistrationParams | null>(null);

  // Commit transaction
  const {
    writeContract: writeCommit,
    data: commitTxHash,
    isPending: isCommitPending,
    error: commitError,
  } = useWriteContract();

  // Register transaction
  const {
    writeContract: writeRegister,
    data: registerTxHash,
    isPending: isRegisterPending,
    error: registerError,
  } = useWriteContract();

  // Wait for commit transaction - poll every 2 seconds for Selendra
  const {
    isLoading: isCommitConfirming,
    isSuccess: isCommitConfirmed,
    isError: isCommitFailed,
    error: commitReceiptError,
  } = useWaitForTransactionReceipt({
    hash: commitTxHash,
    pollingInterval: 2000,
    confirmations: 1,
  });

  // Wait for register transaction - poll every 2 seconds for Selendra
  const {
    isLoading: isRegisterConfirming,
    isSuccess: isRegisterConfirmed,
    isError: isRegisterFailed,
    error: registerReceiptError,
  } = useWaitForTransactionReceipt({
    hash: registerTxHash,
    pollingInterval: 2000,
    confirmations: 1,
  });

  // Derive the actual step from transaction states (pure computation)
  const step: RegistrationStep = (() => {
    if (internalStep === "error" || isCommitFailed || isRegisterFailed) return "error";
    if (isRegisterConfirmed) return "complete";
    if (
      internalStep === "registering" ||
      isRegisterPending ||
      isRegisterConfirming
    )
      return "registering";
    if (isCommitConfirmed || internalStep === "waiting") return "waiting";
    if (internalStep === "committing" || isCommitPending || isCommitConfirming)
      return "committing";
    return internalStep;
  })();

  // NOTE: Secret generation moved to caller (registration-flow.tsx)
  // The caller MUST provide the secret in RegistrationParams so it can be saved to localStorage

  // Calculate commitment hash (matching contract logic)
  const calculateCommitment = useCallback(
    (params: RegistrationParams, secretValue: `0x${string}`): `0x${string}` => {
      const nameWithoutSuffix = removeSuffix(params.name);
      // This matches the contract's makeCommitment function which uses abi.encode
      const encoded = encodeAbiParameters(
        [
          { type: "string" },
          { type: "address" },
          { type: "uint256" },
          { type: "bytes32" },
          { type: "address" },
          { type: "bytes[]" },
          { type: "bool" },
        ],
        [
          nameWithoutSuffix,
          params.owner,
          params.duration,
          secretValue,
          params.resolver ?? CONTRACT_ADDRESSES.PublicResolver,
          params.data ?? [],
          params.reverseRecord ?? true,
        ]
      );
      return keccak256(encoded);
    },
    []
  );

  // Start the registration process
  const register = useCallback(
    async (params: RegistrationParams) => {
      if (!address) {
        setError(new Error("Wallet not connected"));
        return;
      }

      try {
        setError(null);
        setInternalStep("committing");
        setRegistrationParams(params);
        setCommitTimestamp(null); // Reset timestamp for new registration

        // Use the secret provided by caller (so caller can save it to localStorage)
        const secretToUse = params.secret;
        setSecret(secretToUse);

        const newCommitment = calculateCommitment(params, secretToUse);
        setCommitment(newCommitment);

        // Debug logging
        console.log("[SNS] Commit params:", {
          name: removeSuffix(params.name),
          owner: params.owner,
          duration: params.duration.toString(),
          secret: secretToUse,
          resolver: params.resolver ?? CONTRACT_ADDRESSES.PublicResolver,
          data: params.data ?? [],
          reverseRecord: params.reverseRecord ?? true,
          commitment: newCommitment,
        });

        // Submit commitment - use legacy transactions for Selendra
        writeCommit({
          address: CONTRACT_ADDRESSES.SELRegistrarController,
          abi: SELRegistrarControllerABI,
          functionName: "commit",
          args: [newCommitment],
          type: "legacy" as const,
        });
      } catch (err) {
        setError(err as Error);
        setInternalStep("error");
      }
    },
    [address, calculateCommitment, writeCommit]
  );

  // Track when commit is confirmed to set timestamp
  // Using a callback that consumers can call when they detect the waiting state
  const onCommitConfirmed = useCallback(() => {
    if (commitTimestamp === null && isCommitConfirmed) {
      setCommitTimestamp(Date.now());
    }
  }, [commitTimestamp, isCommitConfirmed]);

  // Complete registration after waiting period
  // Can accept overrides for when restoring from localStorage after page refresh
  const completeRegistration = useCallback(async (overrides?: {
    name: string;
    owner: Address;
    duration: bigint;
    secret: `0x${string}`;
  }) => {
    const params = overrides ? {
      name: overrides.name,
      owner: overrides.owner,
      duration: overrides.duration,
      resolver: CONTRACT_ADDRESSES.PublicResolver,
      data: [] as `0x${string}`[],
      reverseRecord: true,
    } : registrationParams;

    const secretToUse = overrides?.secret ?? secret;

    if (!params || !secretToUse) {
      setError(new Error("Missing registration parameters. Please start over."));
      setInternalStep("error");
      return;
    }

    try {
      setError(null);
      setInternalStep("registering");

      const nameWithoutSuffix = removeSuffix(params.name);

      // Debug logging
      console.log("[SNS] Register params:", {
        name: nameWithoutSuffix,
        owner: params.owner,
        duration: params.duration.toString(),
        secret: secretToUse,
        resolver: params.resolver ?? CONTRACT_ADDRESSES.PublicResolver,
        data: params.data ?? [],
        reverseRecord: params.reverseRecord ?? true,
      });

      // Get the price
      const price = await publicClient?.readContract({
        address: CONTRACT_ADDRESSES.SELRegistrarController,
        abi: SELRegistrarControllerABI,
        functionName: "rentPrice",
        args: [nameWithoutSuffix, params.duration],
      });

      const [basePrice, premium] = price ?? [BigInt(0), BigInt(0)];
      const totalPrice = basePrice + premium;

      // Add 10% buffer for gas price fluctuations
      const valueWithBuffer = (totalPrice * BigInt(110)) / BigInt(100);

      console.log("[SNS] Register price:", {
        basePrice: basePrice.toString(),
        premium: premium.toString(),
        total: totalPrice.toString(),
        withBuffer: valueWithBuffer.toString(),
      });

      writeRegister({
        address: CONTRACT_ADDRESSES.SELRegistrarController,
        abi: SELRegistrarControllerABI,
        functionName: "register",
        args: [
          nameWithoutSuffix,
          params.owner,
          params.duration,
          secretToUse,
          params.resolver ?? CONTRACT_ADDRESSES.PublicResolver,
          params.data ?? [],
          params.reverseRecord ?? true,
        ],
        value: valueWithBuffer,
        type: "legacy" as const,
      });
    } catch (err) {
      setError(err as Error);
      setInternalStep("error");
    }
  }, [
    registrationParams,
    secret,
    publicClient,
    writeRegister,
  ]);

  // Sync errors from write hooks and receipt errors
  const currentError =
    error ||
    (commitError as Error | null) ||
    (registerError as Error | null) ||
    (commitReceiptError as Error | null) ||
    (registerReceiptError as Error | null);

  // Calculate remaining wait time using a callback to avoid impure function call during render
  const getRemainingWaitTime = useCallback(() => {
    if (!commitTimestamp) return MIN_COMMITMENT_AGE;
    return Math.max(
      0,
      MIN_COMMITMENT_AGE - (Date.now() - commitTimestamp) / 1000
    );
  }, [commitTimestamp]);

  // Reset the registration state
  const reset = useCallback(() => {
    setInternalStep("idle");
    setSecret(null);
    setCommitment(null);
    setCommitTimestamp(null);
    setError(null);
    setRegistrationParams(null);
  }, []);

  return {
    register,
    completeRegistration,
    reset,
    onCommitConfirmed,
    step,
    secret,
    commitment,
    getRemainingWaitTime,
    isCommitPending,
    isCommitConfirming,
    isRegisterPending,
    isRegisterConfirming,
    commitTxHash,
    registerTxHash,
    error: currentError,
  };
}

// ============ useRenewDomain ============

/**
 * Renew an existing domain
 */
export function useRenewDomain() {
  const publicClient = usePublicClient();

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const renew = useCallback(
    async (name: string, years: number) => {
      const nameWithoutSuffix = removeSuffix(name);
      const duration = BigInt(years) * SECONDS_PER_YEAR;

      // Get the renewal price
      const price = await publicClient?.readContract({
        address: CONTRACT_ADDRESSES.SELRegistrarController,
        abi: SELRegistrarControllerABI,
        functionName: "rentPrice",
        args: [nameWithoutSuffix, duration],
      });

      const [basePrice, premium] = price ?? [BigInt(0), BigInt(0)];
      const totalPrice = basePrice + premium;

      // Add 10% buffer
      const valueWithBuffer = (totalPrice * BigInt(110)) / BigInt(100);

      writeContract({
        address: CONTRACT_ADDRESSES.SELRegistrarController,
        abi: SELRegistrarControllerABI,
        functionName: "renew",
        args: [nameWithoutSuffix, duration],
        value: valueWithBuffer,
        type: "legacy" as const,
      });
    },
    [publicClient, writeContract]
  );

  return {
    renew,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError as Error | null,
  };
}

// ============ useResolve ============

/**
 * Resolve a .sel name to an address
 */
export function useResolve(name: string) {
  const node = namehash(name);
  const enabled = name.length > 0;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PublicResolver,
    abi: PublicResolverABI,
    functionName: "addr",
    args: [node],
    query: {
      enabled,
    },
  });

  return {
    address: data as Address | undefined,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useReverseResolve ============

/**
 * Resolve an address to a .sel name
 */
export function useReverseResolve(address: string) {
  const enabled = address.length === 42 && address.startsWith("0x");

  // First get the reverse node for the address
  const { data: reverseNode } = useReadContract({
    address: CONTRACT_ADDRESSES.ReverseRegistrar,
    abi: ReverseRegistrarABI,
    functionName: "node",
    args: [address as Address],
    query: {
      enabled,
    },
  });

  // Then get the name from the resolver
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PublicResolver,
    abi: PublicResolverABI,
    functionName: "name",
    args: [reverseNode as `0x${string}`],
    query: {
      enabled: enabled && !!reverseNode,
    },
  });

  return {
    name: data as string | undefined,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useOwnedDomains ============

/**
 * Get domains owned by an address
 * Note: This uses events to find owned domains. For production,
 * consider using a subgraph for better performance.
 */
export function useOwnedDomains(ownerAddress: string) {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const publicClient = usePublicClient();
  const enabled = ownerAddress.length === 42 && ownerAddress.startsWith("0x");

  const fetchDomains = useCallback(async () => {
    if (!enabled || !publicClient) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get NameRegistered events from the current controller only
      const nameRegisteredLogs = await publicClient.getLogs({
        address: CONTRACT_ADDRESSES.SELRegistrarController,
        event: {
          type: "event",
          name: "NameRegistered",
          inputs: [
            { name: "name", type: "string", indexed: false },
            { name: "label", type: "bytes32", indexed: true },
            { name: "owner", type: "address", indexed: true },
            { name: "cost", type: "uint256", indexed: false },
            { name: "expires", type: "uint256", indexed: false },
          ],
        },
        fromBlock: "earliest",
        toBlock: "latest",
      });

      // Build a map from labelhash (tokenId as hex) to name
      const labelToName = new Map<string, string>();
      for (const log of nameRegisteredLogs) {
        const label = log.args.label as `0x${string}`;
        const name = log.args.name as string;
        if (label && name) {
          // Convert label (bytes32) to tokenId string for comparison
          const tokenId = BigInt(label).toString();
          labelToName.set(tokenId, name);
        }
      }

      // Get Transfer events to the owner address from BaseRegistrar
      const transferLogs = await publicClient.getLogs({
        address: CONTRACT_ADDRESSES.BaseRegistrar,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true },
          ],
        },
        args: {
          to: ownerAddress as Address,
        },
        fromBlock: "earliest",
        toBlock: "latest",
      });

      // Get unique token IDs owned by the address
      const tokenIds = new Set<bigint>();
      const tokenIdToLastTransfer = new Map<string, Address>();

      // Track all transfers to determine current owner
      const allTransferLogs = await publicClient.getLogs({
        address: CONTRACT_ADDRESSES.BaseRegistrar,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true },
          ],
        },
        fromBlock: "earliest",
        toBlock: "latest",
      });

      // Track the last transfer for each token
      for (const log of allTransferLogs) {
        const tokenId = log.args.tokenId?.toString();
        if (tokenId) {
          tokenIdToLastTransfer.set(tokenId, log.args.to as Address);
        }
      }

      // Filter to only tokens currently owned by the address
      for (const log of transferLogs) {
        const tokenId = log.args.tokenId;
        if (tokenId) {
          const currentOwner = tokenIdToLastTransfer.get(tokenId.toString());
          if (currentOwner?.toLowerCase() === ownerAddress.toLowerCase()) {
            tokenIds.add(tokenId);
          }
        }
      }

      // Get domain info for each token
      const domainInfos: DomainInfo[] = [];

      for (const tokenId of tokenIds) {
        try {
          // Get expiration
          const expires = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.BaseRegistrar,
            abi: BaseRegistrarABI,
            functionName: "nameExpires",
            args: [tokenId],
          });

          // Token ID is the labelhash
          const labelHashHex = toHex(tokenId, { size: 32 });

          // Look up the actual name from the NameRegistered events
          const actualName = labelToName.get(tokenId.toString());

          // Only include domains registered with the current controller
          // (skip domains from old controller that show as "unknown")
          if (actualName) {
            domainInfos.push({
              name: `${actualName}.sel`,
              labelhash: labelHashHex,
              owner: ownerAddress as Address,
              expires: expires as bigint,
            });
          }
        } catch {
          // Skip tokens that fail to load
          console.warn(`Failed to load domain info for token ${tokenId}`);
        }
      }

      setDomains(domainInfos);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, ownerAddress, publicClient]);

  // Fetch on mount and when address changes
  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  return {
    domains,
    isLoading,
    error,
    refetch: fetchDomains,
  };
}

// ============ useGetOwner ============

/**
 * Get the owner of a domain
 */
export function useGetOwner(name: string) {
  const node = namehash(name);
  const enabled = name.length > 0;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.SNSRegistry,
    abi: SNSRegistryABI,
    functionName: "owner",
    args: [node],
    query: {
      enabled,
    },
  });

  return {
    owner: data as Address | undefined,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useGetResolver ============

/**
 * Get the resolver address for a domain
 */
export function useGetResolver(name: string) {
  const node = namehash(name);
  const enabled = name.length > 0;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.SNSRegistry,
    abi: SNSRegistryABI,
    functionName: "resolver",
    args: [node],
    query: {
      enabled,
    },
  });

  return {
    resolver: data as Address | undefined,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useGetTextRecord ============

/**
 * Get a text record for a domain
 */
export function useGetTextRecord(name: string, key: string) {
  const node = namehash(name);
  const enabled = name.length > 0 && key.length > 0;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PublicResolver,
    abi: PublicResolverABI,
    functionName: "text",
    args: [node, key],
    query: {
      enabled,
    },
  });

  return {
    value: data as string | undefined,
    isLoading: enabled ? isLoading : false,
    error: error as Error | null,
    refetch,
  };
}

// ============ useSetPrimaryName ============

/**
 * Set the primary name (reverse record) for the connected wallet
 */
export function useSetPrimaryName() {
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const setPrimaryName = useCallback(
    (name: string) => {
      writeContract({
        address: CONTRACT_ADDRESSES.ReverseRegistrar,
        abi: ReverseRegistrarABI,
        functionName: "setName",
        args: [name],
        type: "legacy" as const,
      });
    },
    [writeContract]
  );

  return {
    setPrimaryName,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError as Error | null,
  };
}

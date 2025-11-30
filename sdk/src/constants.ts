/**
 * Selendra Naming Service SDK Constants
 */

// Chain configurations
export const selendraMainnet = {
  id: 1961,
  name: "Selendra Mainnet",
  nativeCurrency: {
    name: "SEL",
    symbol: "SEL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.selendra.org"],
    },
    public: {
      http: ["https://rpc.selendra.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Selendra Explorer",
      url: "https://explorer.selendra.org",
    },
  },
} as const;

export const selendraTestnet = {
  id: 1953,
  name: "Selendra Testnet",
  nativeCurrency: {
    name: "tSEL",
    symbol: "tSEL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-testnet.selendra.org"],
    },
    public: {
      http: ["https://rpc-testnet.selendra.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Selendra Testnet Explorer",
      url: "https://explorer-testnet.selendra.org",
    },
  },
  testnet: true,
} as const;

// Contract addresses (testnet)
export const testnetAddresses = {
  SNSRegistry: "0x64Ff7c36e879516724dFE312c5D6C704d6bD6be1" as `0x${string}`,
  PublicResolver: "0x4d379C8bbee421f6742b078956F2714D701Aa997" as `0x${string}`,
  BaseRegistrar: "0x875C6bDc6C315FCFF1429B80D39C0259E5cFcaa3" as `0x${string}`,
  PriceOracle: "0xf157c876e1206A2AA22A36EF034986e8B621a851" as `0x${string}`,
  SELRegistrarController:
    "0xD45c5b8df20Bb0be78e85aeaE56606D385770691" as `0x${string}`,
  ReverseRegistrar:
    "0x009439C9b8BFa22f5cbdEb479bAA8e5Fa2041899" as `0x${string}`,
} as const;

// Contract addresses (mainnet) - to be filled after deployment
export const mainnetAddresses = {
  SNSRegistry: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  PublicResolver: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  BaseRegistrar: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  PriceOracle: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  SELRegistrarController:
    "0x0000000000000000000000000000000000000000" as `0x${string}`,
  ReverseRegistrar:
    "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

// Root node (bytes32(0))
export const ROOT_NODE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

// Coin types (SLIP-44)
export const COIN_TYPES = {
  ETH: 60n,
  SEL: 354n,
} as const;

// Grace period (90 days in seconds)
export const GRACE_PERIOD = 90n * 24n * 60n * 60n;

// Minimum registration duration (1 year in seconds)
export const MIN_REGISTRATION_DURATION = 365n * 24n * 60n * 60n;

// Commitment timing
export const MIN_COMMITMENT_AGE = 60n; // 1 minute
export const MAX_COMMITMENT_AGE = 86400n; // 24 hours

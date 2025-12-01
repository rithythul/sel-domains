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
  SNSRegistry: "0x03BB6Dd5756774bdcC7D5BF6c5EF6Ea28E21A22a" as `0x${string}`,
  PublicResolver: "0xFE6c7Ed8FA52FEA2149fd98a60a8e986DBEa0f8a" as `0x${string}`,
  BaseRegistrar: "0xbF0AF7D1b5a6F17A9C6448375B0f1c4788a27Ff6" as `0x${string}`,
  PriceOracle: "0x81eBB2a59e61D268c47f4F707e7D4f2aAfd9b890" as `0x${string}`,
  SELRegistrarController:
    "0x76B2F67AE09E2956967DF4303d9e914791B323dC" as `0x${string}`,
  ReverseRegistrar:
    "0xB708898adFeAC80aA1F9cD1Da2B3113d7f5B825E" as `0x${string}`,
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

"use client";

import { ReactNode } from "react";
import { WagmiProvider, http, createConfig } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { defineChain, type Chain } from "viem";

// Network configuration based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === "mainnet";

// Define Selendra Mainnet (Chain ID 1961)
export const selendraMainnet = defineChain({
  id: 1961,
  name: "Selendra",
  nativeCurrency: {
    decimals: 18,
    name: "Selendra",
    symbol: "SEL",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.selendra.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Selendra Explorer",
      url: "https://explorer.selendra.org",
    },
  },
});

// Define Selendra Testnet (Chain ID 1953)
export const selendraTestnet = defineChain({
  id: 1953,
  name: "Selendra Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Selendra",
    symbol: "SEL",
  },
  rpcUrls: {
    default: {
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
});

// Select chain based on environment
export const activeChain: Chain = isMainnet ? selendraMainnet : selendraTestnet;

// Configure wagmi - separate configs for each network to satisfy TypeScript
const testnetConfig = createConfig({
  chains: [selendraTestnet],
  connectors: [injected()],
  transports: {
    [selendraTestnet.id]: http("https://rpc-testnet.selendra.org"),
  },
  ssr: true,
});

const mainnetConfig = createConfig({
  chains: [selendraMainnet],
  connectors: [injected()],
  transports: {
    [selendraMainnet.id]: http("https://rpc.selendra.org"),
  },
  ssr: true,
});

const config = isMainnet ? mainnetConfig : testnetConfig;

// Create query client
const queryClient = new QueryClient();

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

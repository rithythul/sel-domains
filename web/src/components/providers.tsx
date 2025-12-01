"use client";

import { ReactNode } from "react";
import { WagmiProvider, http, createConfig } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Define Selendra Testnet (Chain ID 1953)
// For development, we use testnet by default
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
      name: "Selendra Portal",
      url: "https://portal.selendra.org/?rpc=wss%3A%2F%2Frpc-testnet.selendra.org#/explorer",
    },
  },
  testnet: true,
});

// Configure wagmi with injected connector only (MetaMask, Coinbase, etc.)
const config = createConfig({
  chains: [selendraTestnet],
  connectors: [injected()],
  transports: {
    [selendraTestnet.id]: http("https://rpc-testnet.selendra.org"),
  },
  ssr: true,
});

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

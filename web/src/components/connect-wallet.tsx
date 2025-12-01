"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance } from "wagmi";
import { activeChain } from "./providers";

export function ConnectWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Format balance for display
  const formatBalance = () => {
    if (!balance) return "";
    const value = parseFloat(balance.formatted);
    if (isNaN(value)) return "";
    return ` (${value.toFixed(2)} ${balance.symbol})`;
  };

  // Check if on wrong network
  const isWrongNetwork = isConnected && chain?.id !== activeChain.id;

  if (!isConnected) {
    return (
      <div className="relative group">
        <button
          type="button"
          disabled={isPending}
          className="bg-[#03A9F4] hover:bg-[#0288D1] text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
          onClick={() => {
            // Try injected wallet first (MetaMask, etc.)
            const injected = connectors.find((c) => c.id === "injected");
            if (injected) {
              connect({ connector: injected });
            }
          }}
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>

        {/* Dropdown for other connectors */}
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isPending}
              className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
            >
              {connector.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <button
        onClick={() => switchChain?.({ chainId: activeChain.id })}
        type="button"
        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
      >
        Switch to Selendra
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="flex items-center gap-2 bg-gray-800 text-white py-2 px-3 rounded-lg">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="hidden sm:inline text-sm">{chain?.name}</span>
      </div>

      <button
        onClick={() => disconnect()}
        type="button"
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg transition-colors duration-200"
      >
        <span className="truncate max-w-[100px] sm:max-w-none">
          {formatAddress(address!)}
          <span className="hidden sm:inline">{formatBalance()}</span>
        </span>
      </button>
    </div>
  );
}

// Simple version - same as main now
export function ConnectWalletSimple() {
  return <ConnectWallet />;
}

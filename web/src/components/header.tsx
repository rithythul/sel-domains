"use client";

import Link from "next/link";
import Image from "next/image";
import { ConnectWallet } from "@/components/connect-wallet";
import { NETWORK_INFO } from "@/lib/contracts";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/selendra-logo.png"
            alt="Selendra"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="text-xl font-bold">
            <span className="text-[#0db0a4]">SNS</span>
          </span>
          {!NETWORK_INFO.isMainnet && (
            <span className="ml-1 rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
              Testnet
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/lookup"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-[#0a9389]"
          >
            Lookup
          </Link>
          <Link
            href="/domains"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-[#0a9389]"
          >
            Domains
          </Link>
          <Link
            href="https://selendra.org/docs"
            target="_blank"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-[#0a9389]"
          >
            Docs
          </Link>
        </nav>

        <ConnectWallet />
      </div>
    </header>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { formatEther, toHex } from "viem";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCheckAvailability,
  useGetPrice,
  useRegisterDomain,
} from "@/hooks/use-sns";
import { ensureSuffix, SECONDS_PER_YEAR, MIN_COMMITMENT_AGE } from "@/lib/utils/namehash";
import {
  Loader2,
  Check,
  Clock,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Copy,
  RefreshCw,
  Shield,
  Timer,
  CheckCircle2,
  PartyPopper,
} from "lucide-react";

// ============ Types ============

type FlowStep = "review" | "commit" | "wait" | "register" | "success" | "error";

interface RegistrationFlowProps {
  name: string;
  years: number;
}

interface StoredRegistrationState {
  name: string;
  years: number;
  secret: string;
  commitTxHash?: string;
  commitTimestamp?: number;
  step: FlowStep;
}

// ============ Constants ============

const STORAGE_KEY = "sns_registration_state";
const WAIT_TIME_SECONDS = MIN_COMMITMENT_AGE; // 60 seconds

// Year options for the selector
const YEAR_OPTIONS = [
  { years: 1, label: "1 Year", discount: 0 },
  { years: 2, label: "2 Years", discount: 0.1 },
  { years: 3, label: "3 Years", discount: 0.1 },
  { years: 4, label: "4 Years", discount: 0.1 },
  { years: 5, label: "5 Years", discount: 0.1 },
];

// Year discount rates (matches contract: 10% for 2+ years)
const YEAR_DISCOUNTS: Record<number, number> = {
  1: 0,
  2: 0.1,
  3: 0.1,
  4: 0.1,
  5: 0.1,
  6: 0.1,
  7: 0.1,
  8: 0.1,
  9: 0.1,
  10: 0.1,
};

// ============ Utility Functions ============

function formatPrice(price: bigint): string {
  const formatted = formatEther(price);
  const num = parseFloat(formatted);
  if (num >= 1000) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (num >= 1) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else {
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
}

function shortenTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function getExplorerUrl(txHash: string): string {
  // Selendra testnet portal - use the Polkadot.js explorer
  return `https://portal.selendra.org/?rpc=wss%3A%2F%2Frpc-testnet.selendra.org#/explorer`;
}

function generateSecret(): `0x${string}` {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return toHex(randomBytes);
}

function saveRegistrationState(state: StoredRegistrationState): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function loadRegistrationState(): StoredRegistrationState | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredRegistrationState;
  } catch {
    return null;
  }
}

function clearRegistrationState(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ============ Sub-Components ============

function ConnectWalletPrompt() {
  const { connectors, connect } = useConnect();

  return (
    <Card className="mx-auto w-full max-w-[600px] border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="h-5 w-5" />
          Wallet Not Connected
        </CardTitle>
        <CardDescription className="text-amber-700">
          Please connect your wallet to register a domain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => {
            const connector = connectors[0];
            if (connector) {
              connect({ connector });
            }
          }}
          className="w-full bg-[#0db0a4] hover:bg-[#0a9389]"
        >
          Connect Wallet
        </Button>
      </CardContent>
    </Card>
  );
}

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: { label: string; description: string }[];
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors ${index < currentStep
                  ? "border-[#0db0a4] bg-[#0db0a4] text-white"
                  : index === currentStep
                    ? "border-[#0db0a4] bg-white text-[#0db0a4]"
                    : "border-gray-300 bg-white text-gray-400"
                  }`}
              >
                {index < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${index <= currentStep ? "text-[#0a9389]" : "text-gray-400"
                  }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 flex-1 transition-colors ${index < currentStep ? "bg-[#0db0a4]" : "bg-gray-200"
                  }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-gray-400 hover:text-gray-600"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function TransactionStatus({
  txHash,
  isPending,
  isConfirming,
  isConfirmed,
  label,
}: {
  txHash?: string;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {isPending && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Awaiting Signature
          </Badge>
        )}
        {isConfirming && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Confirming
          </Badge>
        )}
        {isConfirmed && (
          <Badge className="bg-green-100 text-green-700">
            <Check className="mr-1 h-3 w-3" />
            Confirmed
          </Badge>
        )}
      </div>
      {txHash && (
        <div className="mt-2 flex items-center text-sm text-gray-500">
          <span className="font-mono">{shortenTxHash(txHash)}</span>
          <CopyButton text={txHash} />
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-[#0db0a4] hover:text-[#0a9389]"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}

// ============ Step Components ============

// Get base annual price based on name length (matches contract pricing)
function getBaseAnnualPrice(name: string): bigint {
  // Remove .sel suffix if present to get actual name length
  const cleanName = name.toLowerCase().endsWith('.sel')
    ? name.slice(0, -4)
    : name;
  const len = cleanName.length;
  if (len === 3) return BigInt(1000) * BigInt(10 ** 18); // 1000 SEL
  if (len === 4) return BigInt(250) * BigInt(10 ** 18);  // 250 SEL  
  return BigInt(50) * BigInt(10 ** 18);                  // 50 SEL for 5+ chars
}

function ReviewStep({
  name,
  years,
  price,
  isLoading,
  onBegin,
  onYearsChange,
}: {
  name: string;
  years: number;
  price: bigint;
  isLoading: boolean;
  onBegin: () => void;
  onYearsChange: (years: number) => void;
}) {
  const fullName = ensureSuffix(name);
  const discount = YEAR_DISCOUNTS[years] || 0;
  // Use the base price from name length, not derived from total (which has discount)
  const basePricePerYear = getBaseAnnualPrice(name);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#0db0a4]" />
          Review Registration
        </CardTitle>
        <CardDescription>
          Review the details before starting your registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain Name */}
        <div className="rounded-lg bg-[#e6faf8] p-4 text-center">
          <p className="text-sm text-gray-600">Domain Name</p>
          <p className="mt-1 font-mono text-3xl font-bold text-[#0a9389]">
            {fullName}
          </p>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Registration Period</span>
            <Select
              value={String(years)}
              onValueChange={(value) => onYearsChange(Number(value))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((option) => (
                  <SelectItem key={option.years} value={String(option.years)}>
                    <span className="flex items-center gap-2">
                      <span>{option.label}</span>
                      {option.discount > 0 && (
                        <span className="text-xs text-green-600">
                          -{Math.round(option.discount * 100)}%
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-[#0db0a4]" />
              <span className="ml-2 text-sm text-gray-500">
                Fetching price...
              </span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base Price / Year</span>
                <span className="font-mono text-gray-500">
                  {formatPrice(basePricePerYear)} SEL
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">
                    Multi-year Discount ({Math.round(discount * 100)}%)
                  </span>
                  <span className="font-mono text-green-600">
                    -{formatPrice((basePricePerYear * BigInt(years) * BigInt(Math.round(discount * 100))) / BigInt(100))} SEL
                  </span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-mono text-xl font-bold text-[#0a9389]">
                    {formatPrice(price)} SEL
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Registration uses a two-step
            commit-reveal process to prevent front-running. You&apos;ll submit two
            transactions with a 60-second wait in between.
          </p>
        </div>

        <Button
          onClick={onBegin}
          disabled={isLoading}
          className="w-full bg-[#0db0a4] py-6 text-base font-semibold hover:bg-[#0a9389]"
        >
          Begin Registration
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardContent>
    </Card>
  );
}

function CommitStep({
  name,
  txHash,
  isPending,
  isConfirming,
  isConfirmed,
  error,
  onRetry,
}: {
  name: string;
  txHash?: string;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            Step 1 of 2
          </Badge>
        </div>
        <CardTitle className="mt-2 flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#0db0a4]" />
          Commit Registration
        </CardTitle>
        <CardDescription>
          Submitting your commitment to reserve{" "}
          <span className="font-mono font-semibold">{ensureSuffix(name)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Explanation */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>Why this step?</strong> We first commit a hash of your
            registration to prevent others from seeing and front-running your
            domain registration.
          </p>
        </div>

        {/* Transaction Status */}
        <TransactionStatus
          txHash={txHash}
          isPending={isPending}
          isConfirming={isConfirming}
          isConfirmed={isConfirmed}
          label="Commit Transaction"
        />

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error.message}</p>
            <Button
              onClick={onRetry}
              variant="outline"
              className="mt-3 w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Waiting for confirmation */}
        {(isPending || isConfirming) && !error && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-[#0db0a4]" />
            <span className="ml-3 text-gray-600">
              {isPending
                ? "Please confirm in your wallet..."
                : "Waiting for confirmation..."}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WaitStep({
  remainingTime,
  commitTxHash,
}: {
  remainingTime: number;
  commitTxHash?: string;
}) {
  const progress = Math.max(
    0,
    Math.min(100, ((WAIT_TIME_SECONDS - remainingTime) / WAIT_TIME_SECONDS) * 100)
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-[#0db0a4]" />
          Please Wait
        </CardTitle>
        <CardDescription>
          A short waiting period is required before completing registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Countdown */}
        <div className="text-center">
          <div className="relative mx-auto h-32 w-32">
            <svg className="h-full w-full -rotate-90 transform">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#0db0a4"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * 352} 352`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-[#0a9389]">
                {Math.ceil(remainingTime)}s
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-[#0db0a4] transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-500">
            {remainingTime > 0
              ? "Your commitment is being secured on the blockchain..."
              : "Ready to complete registration!"}
          </p>
        </div>

        {/* Info */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Don&apos;t close this page!</strong> Your registration state
            is saved locally. If you close the browser, you can return to
            continue from where you left off.
          </p>
        </div>

        {/* Commit TX Reference */}
        {commitTxHash && (
          <div className="text-center text-sm text-gray-500">
            <span>Commit TX: </span>
            <a
              href={getExplorerUrl(commitTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#0db0a4] hover:underline"
            >
              {shortenTxHash(commitTxHash)}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegisterStep({
  name,
  txHash,
  isPending,
  isConfirming,
  isConfirmed,
  error,
  onRetry,
  onComplete,
  canComplete,
}: {
  name: string;
  txHash?: string;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  onRetry: () => void;
  onComplete: () => void;
  canComplete: boolean;
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Step 2 of 2
          </Badge>
        </div>
        <CardTitle className="mt-2 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#0db0a4]" />
          Complete Registration
        </CardTitle>
        <CardDescription>
          Final step to claim{" "}
          <span className="font-mono font-semibold">{ensureSuffix(name)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show complete button if not yet started */}
        {canComplete && !txHash && !isPending && !error && (
          <>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-800">
                The waiting period is complete. Click below to finalize your
                registration and claim your domain!
              </p>
            </div>
            <Button
              onClick={onComplete}
              className="w-full bg-[#0db0a4] py-6 text-base font-semibold hover:bg-[#0a9389]"
            >
              Complete Registration
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </>
        )}

        {/* Transaction Status */}
        {(txHash || isPending || isConfirming) && (
          <TransactionStatus
            txHash={txHash}
            isPending={isPending}
            isConfirming={isConfirming}
            isConfirmed={isConfirmed}
            label="Register Transaction"
          />
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error.message}</p>
            <Button
              onClick={onRetry}
              variant="outline"
              className="mt-3 w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Registration
            </Button>
          </div>
        )}

        {/* Waiting for confirmation */}
        {(isPending || isConfirming) && !error && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-[#0db0a4]" />
            <span className="ml-3 text-gray-600">
              {isPending
                ? "Please confirm in your wallet..."
                : "Waiting for confirmation..."}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuccessStep({
  name,
  years,
  txHash,
  onReset,
}: {
  name: string;
  years: number;
  txHash?: string;
  onReset: () => void;
}) {
  const fullName = ensureSuffix(name);
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + years);

  return (
    <Card className="w-full border-green-200 bg-gradient-to-b from-green-50 to-white">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-10 w-10 text-green-600" />
        </div>
        <CardTitle className="text-2xl text-green-800">
          Congratulations!
        </CardTitle>
        <CardDescription className="text-green-700">
          <span className="font-mono text-xl font-bold">{fullName}</span> is
          now yours!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain Info */}
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Domain</span>
              <span className="font-mono font-semibold text-[#0a9389]">
                {fullName}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Registration Period</span>
              <span className="font-medium">
                {years} {years === 1 ? "year" : "years"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Expires</span>
              <span className="font-medium">
                {expiryDate.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Transaction Hash */}
        {txHash && (
          <div className="text-center">
            <p className="text-sm text-gray-500">Transaction</p>
            <div className="flex items-center justify-center">
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-[#0db0a4] hover:underline"
              >
                {shortenTxHash(txHash)}
              </a>
              <CopyButton text={txHash} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid gap-3">
          <Link href={`/domain/${name}`}>
            <Button className="w-full bg-[#0db0a4] hover:bg-[#0a9389]">
              View Domain
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/domain/${name}.sel`}>
            <Button variant="outline" className="w-full">
              Manage Domain
            </Button>
          </Link>
          <Button variant="ghost" className="w-full" onClick={onReset}>
            Register Another Domain
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorStep({
  error,
  onRetry,
  onReset,
}: {
  error: Error | null;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <Card className="w-full border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          Registration Failed
        </CardTitle>
        <CardDescription className="text-red-700">
          {error?.message || "An error occurred during registration"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onRetry} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" className="w-full" onClick={onReset}>
          Start Over
        </Button>
      </CardContent>
    </Card>
  );
}

// ============ Main Component ============

// Helper to get initial state from localStorage
function getInitialState(name: string, defaultYears: number): {
  flowStep: FlowStep;
  remainingTime: number;
  storedSecret: `0x${string}` | null;
  commitTimestamp: number | null;
  storedYears: number;
} {
  if (typeof window === "undefined") {
    return {
      flowStep: "review",
      remainingTime: WAIT_TIME_SECONDS,
      storedSecret: null,
      commitTimestamp: null,
      storedYears: defaultYears,
    };
  }

  const stored = loadRegistrationState();
  if (stored && stored.name === name) {
    const secret = stored.secret ? (stored.secret as `0x${string}`) : null;
    const timestamp = stored.commitTimestamp || null;
    const years = stored.years || defaultYears;

    if (timestamp) {
      const elapsed = (Date.now() - timestamp) / 1000;
      if (elapsed < WAIT_TIME_SECONDS) {
        return {
          flowStep: "wait",
          remainingTime: WAIT_TIME_SECONDS - elapsed,
          storedSecret: secret,
          commitTimestamp: timestamp,
          storedYears: years,
        };
      } else if (stored.step === "wait" || stored.step === "commit") {
        return {
          flowStep: "register",
          remainingTime: 0,
          storedSecret: secret,
          commitTimestamp: timestamp,
          storedYears: years,
        };
      } else {
        return {
          flowStep: stored.step,
          remainingTime: WAIT_TIME_SECONDS,
          storedSecret: secret,
          commitTimestamp: timestamp,
          storedYears: years,
        };
      }
    }
  }

  return {
    flowStep: "review",
    remainingTime: WAIT_TIME_SECONDS,
    storedSecret: null,
    commitTimestamp: null,
    storedYears: defaultYears,
  };
}

// State type
interface RegistrationState {
  flowStep: FlowStep;
  remainingTime: number;
  storedSecret: `0x${string}` | null;
  commitTimestamp: number | null;
  isInitialized: boolean;
}

// Action types
type RegistrationAction =
  | { type: "INITIALIZE"; payload: { flowStep: FlowStep; remainingTime: number; storedSecret: `0x${string}` | null; commitTimestamp: number | null } }
  | { type: "SET_FLOW_STEP"; payload: FlowStep }
  | { type: "SET_REMAINING_TIME"; payload: number }
  | { type: "SET_SECRET"; payload: `0x${string}` }
  | { type: "SET_COMMIT_TIMESTAMP"; payload: number }
  | { type: "ENTER_WAITING"; payload: { timestamp: number } }
  | { type: "RESET" };

// Reducer
function registrationReducer(state: RegistrationState, action: RegistrationAction): RegistrationState {
  switch (action.type) {
    case "INITIALIZE":
      return {
        ...state,
        ...action.payload,
        isInitialized: true,
      };
    case "SET_FLOW_STEP":
      return { ...state, flowStep: action.payload };
    case "SET_REMAINING_TIME":
      return { ...state, remainingTime: action.payload };
    case "SET_SECRET":
      return { ...state, storedSecret: action.payload };
    case "SET_COMMIT_TIMESTAMP":
      return { ...state, commitTimestamp: action.payload };
    case "ENTER_WAITING":
      return {
        ...state,
        flowStep: "wait",
        commitTimestamp: action.payload.timestamp,
      };
    case "RESET":
      return {
        flowStep: "review",
        remainingTime: WAIT_TIME_SECONDS,
        storedSecret: null,
        commitTimestamp: null,
        isInitialized: true,
      };
    default:
      return state;
  }
}

export function RegistrationFlow({ name, years: initialYears }: RegistrationFlowProps) {
  const { address, isConnected } = useAccount();

  // Get initial state from localStorage (includes stored years from commit)
  const initialState = useMemo(() => getInitialState(name, initialYears), [name, initialYears]);

  // Internal state for years - use stored years if resuming, otherwise use URL param
  const [selectedYears, setSelectedYears] = useState(initialState.storedYears);

  // Use reducer for state management
  const [state, dispatch] = useReducer(registrationReducer, {
    flowStep: "review",
    remainingTime: WAIT_TIME_SECONDS,
    storedSecret: null,
    commitTimestamp: null,
    isInitialized: false,
  });

  const { flowStep, remainingTime, storedSecret, commitTimestamp, isInitialized } = state;

  // Track if we've handled the waiting state transition
  const hasHandledWaiting = useRef(false);

  // Check availability
  const { available, isLoading: isCheckingAvailability } =
    useCheckAvailability(name);

  // Get price - use selectedYears for dynamic updates
  const { total: price, isLoading: isPriceLoading } = useGetPrice(name, selectedYears);

  // Registration hook
  const {
    register,
    completeRegistration,
    reset: resetRegistration,
    onCommitConfirmed,
    step: registrationStep,
    commitTxHash,
    registerTxHash,
    isCommitPending,
    isCommitConfirming,
    isRegisterPending,
    isRegisterConfirming,
    error: registrationError,
  } = useRegisterDomain();

  // Load initial state from localStorage on mount (client-side only)
  useEffect(() => {
    if (!isInitialized) {
      dispatch({
        type: "INITIALIZE",
        payload: {
          flowStep: initialState.flowStep,
          remainingTime: initialState.remainingTime,
          storedSecret: initialState.storedSecret,
          commitTimestamp: initialState.commitTimestamp,
        },
      });
      // Also update selectedYears if we have a stored value
      if (initialState.storedYears !== initialYears) {
        setSelectedYears(initialState.storedYears);
      }
    }
  }, [name, isInitialized, initialState, initialYears]);

  // Derive flow step from registration hook state
  const derivedFlowStep = useMemo((): FlowStep => {
    // Once in success or error from hook, stay there
    if (registrationStep === "complete") return "success";
    if (registrationStep === "error") return "error";
    if (registrationStep === "registering") return "register";
    if (registrationStep === "committing") return "commit";

    // For waiting state, check if local state has advanced to register
    // (happens when countdown reaches 0)
    if (registrationStep === "waiting") {
      // If local state has moved to "register", use that
      if (flowStep === "register") return "register";
      return "wait";
    }

    // Otherwise use local state
    return flowStep;
  }, [registrationStep, flowStep]);

  // Handle waiting state transition and side effects
  useEffect(() => {
    if (registrationStep === "waiting" && !hasHandledWaiting.current && !commitTimestamp) {
      hasHandledWaiting.current = true;
      const now = Date.now();
      dispatch({ type: "ENTER_WAITING", payload: { timestamp: now } });
      onCommitConfirmed();
      saveRegistrationState({
        name,
        years: selectedYears,
        secret: storedSecret || "",
        commitTxHash: commitTxHash,
        commitTimestamp: now,
        step: "wait",
      });
    } else if (registrationStep !== "waiting") {
      hasHandledWaiting.current = false;
    }

    if (registrationStep === "complete") {
      clearRegistrationState();
    }
  }, [registrationStep, commitTimestamp, name, selectedYears, storedSecret, commitTxHash, onCommitConfirmed]);

  // Countdown timer - check immediately and then every second
  useEffect(() => {
    if (derivedFlowStep !== "wait") return;
    if (!commitTimestamp) return;

    // Check immediately on mount/timestamp change
    const checkAndUpdate = () => {
      const elapsed = (Date.now() - commitTimestamp) / 1000;
      const remaining = Math.max(0, WAIT_TIME_SECONDS - elapsed);
      dispatch({ type: "SET_REMAINING_TIME", payload: remaining });
      return remaining;
    };

    // If already elapsed, transition immediately
    const initialRemaining = checkAndUpdate();
    if (initialRemaining <= 0) {
      dispatch({ type: "SET_FLOW_STEP", payload: "register" });
      return;
    }

    // Otherwise start interval
    const interval = setInterval(() => {
      const remaining = checkAndUpdate();
      if (remaining <= 0) {
        clearInterval(interval);
        dispatch({ type: "SET_FLOW_STEP", payload: "register" });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [derivedFlowStep, commitTimestamp]);

  // Handle begin registration
  const handleBegin = useCallback(() => {
    if (!address) return;

    const secret = generateSecret();
    dispatch({ type: "SET_SECRET", payload: secret });

    // Save initial state BEFORE calling register
    // This ensures the same secret is used for both commit and register
    saveRegistrationState({
      name,
      years: selectedYears,
      secret,
      step: "commit",
    });

    // Pass the secret to register() so the hook uses the SAME secret we saved
    register({
      name,
      owner: address,
      duration: BigInt(selectedYears) * SECONDS_PER_YEAR,
      secret,  // <-- CRITICAL: Pass the same secret we saved to localStorage
      reverseRecord: true,
    });
  }, [address, name, selectedYears, register]);

  // Handle complete registration - pass stored params if hook state was lost (page refresh)
  const handleComplete = useCallback(() => {
    if (address && storedSecret) {
      // Pass overrides in case hook state was lost after page refresh
      completeRegistration({
        name,
        owner: address,
        duration: BigInt(selectedYears) * SECONDS_PER_YEAR,
        secret: storedSecret,
      });
    } else {
      completeRegistration();
    }
  }, [address, name, selectedYears, storedSecret, completeRegistration]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (derivedFlowStep === "commit") {
      handleBegin();
    } else if (derivedFlowStep === "register" || derivedFlowStep === "error") {
      handleComplete();
    }
  }, [derivedFlowStep, handleBegin, handleComplete]);

  // Handle reset
  const handleReset = useCallback(() => {
    clearRegistrationState();
    resetRegistration();
    dispatch({ type: "RESET" });
    window.location.href = "/";
  }, [resetRegistration]);

  // Check if wallet connected
  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  // Check if domain is still available
  if (!isCheckingAvailability && !available && derivedFlowStep === "review") {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            Domain Not Available
          </CardTitle>
          <CardDescription className="text-red-700">
            <span className="font-mono font-semibold">{ensureSuffix(name)}</span>{" "}
            is no longer available for registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button className="w-full bg-[#0db0a4] hover:bg-[#0a9389]">
              Search for Another Domain
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Step indicator configuration
  const steps = [
    { label: "Review", description: "Review details" },
    { label: "Commit", description: "Submit commitment" },
    { label: "Wait", description: "60 second wait" },
    { label: "Register", description: "Complete registration" },
  ];

  const currentStepIndex =
    derivedFlowStep === "review"
      ? 0
      : derivedFlowStep === "commit"
        ? 1
        : derivedFlowStep === "wait"
          ? 2
          : derivedFlowStep === "register"
            ? 3
            : derivedFlowStep === "success"
              ? 4
              : 0;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step Indicator */}
      {derivedFlowStep !== "success" && derivedFlowStep !== "error" && (
        <StepIndicator currentStep={currentStepIndex} steps={steps} />
      )}

      {/* Step Content */}
      {derivedFlowStep === "review" && (
        <ReviewStep
          name={name}
          years={selectedYears}
          price={price}
          isLoading={isPriceLoading}
          onBegin={handleBegin}
          onYearsChange={setSelectedYears}
        />
      )}

      {derivedFlowStep === "commit" && (
        <CommitStep
          name={name}
          txHash={commitTxHash}
          isPending={isCommitPending}
          isConfirming={isCommitConfirming}
          isConfirmed={registrationStep === "waiting"}
          error={registrationError}
          onRetry={handleRetry}
        />
      )}

      {derivedFlowStep === "wait" && (
        <WaitStep remainingTime={remainingTime} commitTxHash={commitTxHash} />
      )}

      {derivedFlowStep === "register" && (
        <RegisterStep
          name={name}
          txHash={registerTxHash}
          isPending={isRegisterPending}
          isConfirming={isRegisterConfirming}
          isConfirmed={registrationStep === "complete"}
          error={registrationError}
          onRetry={handleRetry}
          onComplete={handleComplete}
          canComplete={remainingTime <= 0}
        />
      )}

      {derivedFlowStep === "success" && (
        <SuccessStep
          name={name}
          years={selectedYears}
          txHash={registerTxHash}
          onReset={handleReset}
        />
      )}

      {derivedFlowStep === "error" && (
        <ErrorStep
          error={registrationError}
          onRetry={handleRetry}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

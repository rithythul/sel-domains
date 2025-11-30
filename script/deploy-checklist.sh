#!/bin/bash
# SNS Deployment Checklist Script
# Usage: ./script/deploy-checklist.sh [testnet|mainnet]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Network configuration
NETWORK=${1:-testnet}

if [ "$NETWORK" == "mainnet" ]; then
    CHAIN_ID=1961
    RPC_URL="https://rpc.selendra.org"
    EXPLORER_URL="https://explorer.selendra.org"
    DEPLOYMENT_FILE="deployments/mainnet.json"
else
    CHAIN_ID=1953
    RPC_URL="https://rpc-testnet.selendra.org"
    EXPLORER_URL="https://explorer.selendra.org"
    DEPLOYMENT_FILE="deployments/testnet.json"
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       SNS Deployment Checklist - ${NETWORK^^}                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============ PRE-DEPLOYMENT CHECKS ============
echo -e "${YELLOW}▶ PRE-DEPLOYMENT CHECKS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check environment variables
echo -n "  [1] Checking PRIVATE_KEY... "
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}✗ MISSING${NC}"
    echo -e "      ${RED}Set with: export PRIVATE_KEY=0x...${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Set${NC}"
fi

# Check RPC connectivity
echo -n "  [2] Checking RPC connectivity ($RPC_URL)... "
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "$RPC_URL" | grep -q "0x"; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    exit 1
fi

# Check deployer balance
echo -n "  [3] Checking deployer balance... "
DEPLOYER=$(cast wallet address "$PRIVATE_KEY" 2>/dev/null || echo "unknown")
if [ "$DEPLOYER" != "unknown" ]; then
    BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    BALANCE_ETH=$(cast from-wei "$BALANCE" 2>/dev/null || echo "0")
    if (( $(echo "$BALANCE_ETH > 1" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${GREEN}✓ $BALANCE_ETH SEL${NC}"
    else
        echo -e "${YELLOW}⚠ Low balance: $BALANCE_ETH SEL (need >1 SEL)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Could not determine (cast not available)${NC}"
fi

# Build contracts
echo ""
echo -n "  [4] Building contracts... "
if forge build --silent 2>/dev/null; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    echo -e "      Run: ${YELLOW}forge build${NC} to see errors"
    exit 1
fi

# Run tests
echo -n "  [5] Running tests... "
if forge test --silent 2>/dev/null; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    echo -e "      Run: ${YELLOW}forge test -vvv${NC} to see failures"
    exit 1
fi

echo ""
echo -e "${YELLOW}▶ DEPLOYMENT${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  Network:  ${BLUE}$NETWORK${NC} (Chain ID: $CHAIN_ID)"
echo -e "  RPC:      ${BLUE}$RPC_URL${NC}"
echo -e "  Deployer: ${BLUE}$DEPLOYER${NC}"
echo ""
echo -e "  ${YELLOW}Ready to deploy? This will:${NC}"
echo "    • Deploy SNSRegistry"
echo "    • Deploy PublicResolver"
echo "    • Deploy BaseRegistrar (creates .sel TLD)"
echo "    • Deploy PriceOracle (1000/250/50 SEL pricing)"
echo "    • Deploy SELRegistrarController"
echo "    • Deploy ReverseRegistrar"
echo "    • Configure all contract relationships"
echo ""

read -p "  Proceed with deployment? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "  ${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "  ${BLUE}Deploying contracts...${NC}"
echo ""

# Deploy
forge script script/DeploySNS.s.sol:DeploySNS \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$PRIVATE_KEY" \
    --legacy \
    -vvv

echo ""
echo -e "${YELLOW}▶ POST-DEPLOYMENT${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${GREEN}✓ Deployment complete!${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "    1. Update $DEPLOYMENT_FILE with new contract addresses"
echo "    2. Update sdk/src/constants.ts with new addresses"
echo "    3. Verify contracts on explorer:"
echo -e "       ${BLUE}forge verify-contract <ADDRESS> <CONTRACT> --chain $CHAIN_ID${NC}"
echo "    4. Test registration flow with SDK"
echo "    5. Reserve premium names (selendra.sel, bitriel.sel, etc.)"
echo ""
echo -e "  ${BLUE}Broadcast logs:${NC} broadcast/DeploySNS.s.sol/$CHAIN_ID/"
echo -e "  ${BLUE}Explorer:${NC} $EXPLORER_URL"
echo ""

# ============ VERIFICATION COMMANDS ============
echo -e "${YELLOW}▶ VERIFICATION COMMANDS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  # Verify each contract (replace <ADDRESS> with actual addresses):"
echo ""
echo "  forge verify-contract <REGISTRY_ADDR> src/SNSRegistry.sol:SNSRegistry \\"
echo "    --chain $CHAIN_ID --watch"
echo ""
echo "  forge verify-contract <RESOLVER_ADDR> src/PublicResolver.sol:PublicResolver \\"
echo "    --chain $CHAIN_ID --constructor-args \$(cast abi-encode 'constructor(address)' <REGISTRY_ADDR>) --watch"
echo ""
echo "  forge verify-contract <REGISTRAR_ADDR> src/BaseRegistrar.sol:BaseRegistrar \\"
echo "    --chain $CHAIN_ID --constructor-args \$(cast abi-encode 'constructor(address,bytes32)' <REGISTRY_ADDR> <SEL_NODE>) --watch"
echo ""

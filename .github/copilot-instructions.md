# Selendra Naming Service (SNS) - Copilot Instructions

## Architecture Overview

SNS is a decentralized naming system for `.sel` domains on Selendra (ENS-inspired). The stack:

```
Contracts (src/)     SDK (sdk/)        Web (web/)
├── SNSRegistry      ├── SNS class     └── Next.js app
├── BaseRegistrar    ├── utils.ts
├── SELRegistrar     └── constants.ts
│   Controller
├── PublicResolver
├── PriceOracle
└── ReverseRegistrar
```

**Data flow**: User → Controller (commit-reveal) → BaseRegistrar (ERC-721 NFT) → Registry (namehash→owner mapping) → Resolver (records storage)

## Development Workflow

### Smart Contracts (Foundry)
```bash
forge build                       # Compile contracts
forge test -vvv                   # Run tests with verbose output
forge test --match-test testName  # Run specific test
forge fmt                         # Format Solidity code
```

### Deploy to Selendra (IMPORTANT: always use `--legacy` flag)
```bash
forge script script/DeploySNS.s.sol:DeploySNS \
  --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy
```

### SDK/Web
```bash
cd sdk && npm run build    # Build TypeScript SDK
cd web && npm run dev      # Start Next.js dev server
```

## Critical Patterns

### Namehash Algorithm (EIP-137)
```solidity
// namehash is recursive: namehash("alice.sel") = keccak256(namehash("sel"), keccak256("alice"))
bytes32 selNode = keccak256(abi.encodePacked(ROOT_NODE, keccak256("sel")));
bytes32 aliceNode = keccak256(abi.encodePacked(selNode, keccak256("alice")));
```

### Commit-Reveal Registration (prevent front-running)
1. `makeCommitment()` → hash of (name, owner, secret, ...)
2. `commit(hash)` → store timestamp
3. Wait 60 seconds (MIN_COMMITMENT_AGE)
4. `register()` with same params + payment

### Test Setup Pattern
```solidity
function setUp() public {
    vm.warp(1704067200);  // Set realistic timestamp (Foundry defaults to 0)
    vm.deal(alice, 1000 ether);  // Fund test accounts
    
    registry = new SNSRegistry();
    selNode = keccak256(abi.encodePacked(ROOT_NODE, keccak256("sel")));
    registry.setSubnodeOwner(ROOT_NODE, keccak256("sel"), owner);
    // ... deploy other contracts
    registrar.addController(address(controller));  // Don't forget this!
}
```

### SDK Transaction Pattern
```typescript
// All write operations require type: "legacy" for Selendra
return controller.write.commit([commitment], { type: "legacy" as any });
```

## Key Conventions

- **Imports**: Use remappings (`@openzeppelin/`, `forge-std/`) defined in [remappings.txt](remappings.txt)
- **Solidity version**: 0.8.20 with optimizer enabled and `via_ir = true`
- **Contract interfaces**: Define in [src/interfaces/ISNSContracts.sol](src/interfaces/ISNSContracts.sol)
- **Test naming**: `test_FunctionName_Scenario()` e.g., `test_Register_RevertIfNoCommitment()`
- **Price tiers**: 3 chars = 1000 SEL, 4 chars = 250 SEL, 5+ chars = 50 SEL per year
- **Deployment script**: Use `./script/deploy-checklist.sh [testnet|mainnet]` for guided deployment

## Governance & Reserved Names

The `SELRegistrarController` owner can:
- **Reserve names**: `reserveName("selendra")` or `reserveNames(["selendra", "bitriel"])`
- **Register reserved names**: `registerReserved("selendra", ownerAddr, duration, resolver)` - bypasses payment
- **Update pricing**: `setPriceOracle(newOracleAddr)`
- **Withdraw fees**: `withdraw(toAddr)`

Reserve names script: `CONTROLLER=0x... forge script script/ReserveNames.s.sol:ReserveNames --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy`

## Network Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Mainnet | 1961 | https://rpc.selendra.org |
| Testnet | 1953 | https://rpc-testnet.selendra.org |

Contract addresses are in [sdk/src/constants.ts](sdk/src/constants.ts) and [deployments/testnet.json](deployments/testnet.json).

## Common Gotchas

1. **Foundry timestamp**: Tests fail if you don't `vm.warp()` to a realistic time
2. **Legacy transactions**: Selendra requires `--legacy` flag for deployments and `type: "legacy"` in SDK
3. **Controller registration**: `BaseRegistrar.addController(controller)` must be called post-deploy
4. **Name validation**: Only lowercase alphanumeric + hyphens, 3-63 chars, no leading/trailing hyphens

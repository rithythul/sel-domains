# SNS Technical Stack

> Technology choices and architecture decisions

## Stack Overview

| Layer               | Technology        | Purpose                       |
| ------------------- | ----------------- | ----------------------------- |
| **Smart Contracts** | Solidity 0.8.20   | Core protocol logic           |
| **Development**     | Foundry           | Compile, test, deploy, verify |
| **SDK**             | Viem + TypeScript | Client library for dApps      |
| **Frontend**        | Next.js + Viem    | Web application               |
| **Testing**         | Forge (Solidity)  | Unit, integration, fuzz tests |

---

## Why Foundry?

### Comparison with Hardhat

| Aspect            | Foundry           | Hardhat               |
| ----------------- | ----------------- | --------------------- |
| **Speed**         | ⚡ 10-100x faster | Slower (Node.js)      |
| **Test Language** | Solidity          | JavaScript/TypeScript |
| **Fuzzing**       | Built-in          | Plugin needed         |
| **Gas Reports**   | Built-in          | Plugin needed         |
| **Stack Traces**  | Detailed          | Limited               |
| **Dependencies**  | Git submodules    | npm packages          |

### Key Benefits

1. **Tests in Solidity** - Same language as contracts, better type safety
2. **Fast Iteration** - Compile + test in seconds
3. **Native Fuzzing** - Find edge cases automatically
4. **Forge Script** - Deploy scripts in Solidity, no JS runtime issues

---

## Why Viem?

### Comparison with Ethers.js

| Aspect           | Viem        | Ethers.js   |
| ---------------- | ----------- | ----------- |
| **Bundle Size**  | ~35kb       | ~120kb      |
| **Tree Shaking** | ✅ Full     | ⚠️ Partial  |
| **TypeScript**   | First-class | Good        |
| **Performance**  | Faster      | Slower      |
| **API Design**   | Functional  | Class-based |

### Key Benefits

1. **Smaller Bundles** - Better for SDK users
2. **Type Safety** - Strict TypeScript throughout
3. **Modern API** - Functional, composable design
4. **Active Development** - Maintained by wagmi team

---

## Project Structure

```
sel-domains/
├── docs/                    # Documentation
│   ├── design.md           # Architecture & design
│   ├── tech.md             # This file
│   └── tasks.md            # Roadmap & tasks
│
├── src/                     # Solidity contracts
│   ├── SNSRegistry.sol
│   ├── BaseRegistrar.sol
│   ├── SELRegistrarController.sol
│   ├── PublicResolver.sol
│   ├── ReverseRegistrar.sol
│   ├── PriceOracle.sol
│   └── interfaces/
│       └── ISNSContracts.sol
│
├── test/                    # Solidity tests
│   ├── SNSRegistry.t.sol
│   ├── BaseRegistrar.t.sol
│   ├── SELRegistrarController.t.sol
│   ├── PublicResolver.t.sol
│   └── helpers/
│       └── TestHelpers.sol
│
├── script/                  # Deployment scripts
│   ├── Deploy.s.sol        # Main deployment
│   ├── Configure.s.sol     # Post-deploy config
│   └── helpers/
│       └── DeployHelpers.sol
│
├── sdk/                     # TypeScript SDK
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── actions/
│   │   │   ├── resolve.ts
│   │   │   ├── register.ts
│   │   │   └── records.ts
│   │   ├── utils/
│   │   │   ├── namehash.ts
│   │   │   └── validation.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── web/                     # Next.js frontend
│   └── ...
│
├── foundry.toml             # Foundry config
├── remappings.txt           # Import remappings
├── package.json             # Root package.json
└── README.md
```

---

## Foundry Configuration

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
via_ir = false
evm_version = "paris"

[profile.default.fuzz]
runs = 256
max_test_rejects = 65536

[profile.ci.fuzz]
runs = 10000

[rpc_endpoints]
selendra_mainnet = "https://rpc.selendra.org"
selendra_testnet = "https://rpc-testnet.selendra.org"
localhost = "http://127.0.0.1:8545"

[etherscan]
selendra_mainnet = { key = "${ETHERSCAN_API_KEY}", url = "https://explorer.selendra.org/api" }
selendra_testnet = { key = "${ETHERSCAN_API_KEY}", url = "https://explorer-testnet.selendra.org/api" }

[fmt]
line_length = 100
tab_width = 4
bracket_spacing = true
int_types = "long"
multiline_func_header = "params_first"
quote_style = "double"
number_underscore = "thousands"
```

### remappings.txt

```
@openzeppelin/=lib/openzeppelin-contracts/
forge-std/=lib/forge-std/src/
```

---

## Contract Patterns

### Access Control

Using OpenZeppelin's `Ownable` for admin functions:

```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BaseRegistrar is ERC721, Ownable {
    mapping(address => bool) public controllers;

    modifier onlyController() {
        require(controllers[msg.sender], "Not a controller");
        _;
    }

    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
    }
}
```

### ERC-721 for Domains

```solidity
contract BaseRegistrar is ERC721 {
    // tokenId = labelhash(name)
    // e.g., tokenId = keccak256("alice")

    function register(uint256 id, address owner, uint256 duration)
        external onlyController returns (uint256)
    {
        _mint(owner, id);
        expiries[id] = block.timestamp + duration;
        return expiries[id];
    }
}
```

### Commit-Reveal

```solidity
contract SELRegistrarController {
    mapping(bytes32 => uint256) public commitments;

    uint256 public constant MIN_COMMITMENT_AGE = 60;
    uint256 public constant MAX_COMMITMENT_AGE = 86400;

    function commit(bytes32 commitment) external {
        require(commitments[commitment] + MAX_COMMITMENT_AGE < block.timestamp,
            "Commitment exists");
        commitments[commitment] = block.timestamp;
    }

    function register(..., bytes32 secret) external payable {
        bytes32 commitment = makeCommitment(..., secret);
        require(commitments[commitment] > 0, "No commitment");
        require(block.timestamp >= commitments[commitment] + MIN_COMMITMENT_AGE,
            "Too early");
        require(block.timestamp < commitments[commitment] + MAX_COMMITMENT_AGE,
            "Expired");

        delete commitments[commitment];
        // ... registration logic
    }
}
```

---

## Testing Strategy

### Unit Tests

Test individual functions in isolation:

```solidity
// test/SNSRegistry.t.sol
contract SNSRegistryTest is Test {
    SNSRegistry registry;

    function setUp() public {
        registry = new SNSRegistry();
    }

    function test_SetOwner() public {
        bytes32 node = keccak256("test");
        registry.setOwner(node, address(0x1));
        assertEq(registry.owner(node), address(0x1));
    }
}
```

### Integration Tests

Test contract interactions:

```solidity
// test/Integration.t.sol
contract IntegrationTest is Test {
    SNSRegistry registry;
    BaseRegistrar registrar;
    SELRegistrarController controller;

    function test_FullRegistrationFlow() public {
        // 1. Commit
        bytes32 commitment = controller.makeCommitment(...);
        controller.commit(commitment);

        // 2. Wait
        vm.warp(block.timestamp + 61);

        // 3. Register
        controller.register{value: price}(...);

        // 4. Verify
        assertEq(registry.owner(node), user);
    }
}
```

### Fuzz Tests

Find edge cases automatically:

```solidity
// test/PriceOracle.t.sol
contract PriceOracleTest is Test {
    function testFuzz_PriceAlwaysPositive(
        string memory name,
        uint256 duration
    ) public {
        vm.assume(bytes(name).length >= 3);
        vm.assume(duration > 0 && duration < 100 * 365 days);

        (uint256 base, ) = oracle.price(name, duration);
        assertGt(base, 0);
    }
}
```

---

## SDK Architecture

### Core Client

```typescript
// sdk/src/client.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { selendra, selendraTestnet } from "./chains";

export function createSNSClient(config: SNSConfig) {
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  return {
    // Read operations
    resolve: (name: string) => resolve(publicClient, config, name),
    lookupAddress: (address: Address) =>
      lookupAddress(publicClient, config, address),
    isAvailable: (name: string) => isAvailable(publicClient, config, name),
    getPrice: (name: string, duration: bigint) =>
      getPrice(publicClient, config, name, duration),

    // Write operations (require wallet)
    register: (wallet: WalletClient, params: RegisterParams) =>
      register(publicClient, wallet, config, params),
    setRecords: (wallet: WalletClient, name: string, records: Records) =>
      setRecords(publicClient, wallet, config, name, records),
  };
}
```

### Actions

```typescript
// sdk/src/actions/resolve.ts
import { namehash } from "../utils/namehash";

export async function resolve(
  client: PublicClient,
  config: SNSConfig,
  name: string
): Promise<Address | null> {
  const node = namehash(name);

  // Get resolver
  const resolverAddress = await client.readContract({
    address: config.registry,
    abi: registryAbi,
    functionName: "resolver",
    args: [node],
  });

  if (resolverAddress === zeroAddress) return null;

  // Get address from resolver
  const address = await client.readContract({
    address: resolverAddress,
    abi: resolverAbi,
    functionName: "addr",
    args: [node],
  });

  return address === zeroAddress ? null : address;
}
```

### Type Generation

Generate TypeScript types from ABI:

```bash
# Generate types using wagmi cli
npx wagmi generate
```

```typescript
// sdk/src/types/contracts.ts
export const registryAbi = [...] as const;
export const resolverAbi = [...] as const;
export const controllerAbi = [...] as const;

// Auto-generated types
export type RegistryAbi = typeof registryAbi;
```

---

## Deployment

### Forge Script

```solidity
// script/Deploy.s.sol
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts
        SNSRegistry registry = new SNSRegistry();
        PublicResolver resolver = new PublicResolver(address(registry));
        BaseRegistrar registrar = new BaseRegistrar(
            address(registry),
            namehash("sel")
        );
        // ... more deployments

        // Configure
        registry.setSubnodeOwner(bytes32(0), labelhash("sel"), address(registrar));
        registrar.addController(address(controller));

        vm.stopBroadcast();

        // Log addresses
        console.log("Registry:", address(registry));
        console.log("Resolver:", address(resolver));
        // ...
    }
}
```

### Commands

```bash
# Deploy to testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url selendra_testnet \
  --broadcast \
  --verify

# Deploy to mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url selendra_mainnet \
  --broadcast \
  --verify \
  --slow
```

---

## Environment Setup

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Node.js dependencies (for SDK)
npm install
```

### Environment Variables

```bash
# .env
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_api_key_here

# Optional
RPC_URL_TESTNET=https://rpc-testnet.selendra.org
RPC_URL_MAINNET=https://rpc.selendra.org
```

---

## Commands Reference

### Foundry

```bash
# Build
forge build

# Test
forge test
forge test -vvv                    # Verbose
forge test --match-test testName   # Specific test
forge test --gas-report            # Gas report

# Coverage
forge coverage

# Format
forge fmt

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# Verify
forge verify-contract $ADDRESS Contract --chain selendra-testnet
```

### SDK

```bash
cd sdk

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

---

## Network Configuration

| Network | Chain ID | RPC                              | Explorer                              |
| ------- | -------- | -------------------------------- | ------------------------------------- |
| Mainnet | 1961     | https://rpc.selendra.org         | https://explorer.selendra.org         |
| Testnet | 1953     | https://rpc-testnet.selendra.org | https://explorer-testnet.selendra.org |

---

## References

- [Foundry Book](https://book.getfoundry.sh)
- [Viem Documentation](https://viem.sh)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {SELRegistrarController} from "../src/SELRegistrarController.sol";

/**
 * @title ReserveNames
 * @notice Script to reserve premium/protected names on SNS
 * 
 * Usage:
 *   CONTROLLER=0x... forge script script/ReserveNames.s.sol:ReserveNames \
 *     --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy
 */
contract ReserveNames is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address controllerAddress = vm.envAddress("CONTROLLER");
        
        SELRegistrarController controller = SELRegistrarController(controllerAddress);
        
        console.log("Reserving premium names on SNS Controller:", controllerAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ============ Brand Names ============
        string[] memory brandNames = new string[](10);
        brandNames[0] = "selendra";
        brandNames[1] = "bitriel";
        brandNames[2] = "baray";
        brandNames[3] = "koompi";
        brandNames[4] = "org";
        brandNames[5] = "foundation";
        brandNames[6] = "dao";
        brandNames[7] = "sns";
        brandNames[8] = "sel";
        brandNames[9] = "admin";
        brandNames[10] = "grood";
        brandNames[10] = "sv";        
        brandNames[10] = "sw";
        brandNames[10] = "nimmit";
        brandNames[10] = "nimit";
        brandNames[10] = "nimmit";
                

        controller.reserveNames(brandNames);
        console.log("Reserved brand names:", brandNames.length);
        
        // ============ Protocol Names ============
        string[] memory protocolNames = new string[](8);
        protocolNames[0] = "registry";
        protocolNames[1] = "resolver";
        protocolNames[2] = "registrar";
        protocolNames[3] = "oracle";
        protocolNames[4] = "governance";
        protocolNames[5] = "treasury";
        protocolNames[6] = "vault";
        protocolNames[7] = "bridge";
        
        controller.reserveNames(protocolNames);
        console.log("Reserved protocol names:", protocolNames.length);
        
        // ============ Common Short Names (3 chars) ============
        string[] memory shortNames = new string[](15);
        shortNames[0] = "eth";
        shortNames[1] = "btc";
        shortNames[2] = "nft";
        shortNames[3] = "web";
        shortNames[4] = "app";
        shortNames[5] = "pay";
        shortNames[6] = "buy";
        shortNames[7] = "dev";
        shortNames[8] = "api";
        shortNames[9] = "bot";
        shortNames[10] = "god";
        shortNames[11] = "vip";
        shortNames[12] = "ceo";
        shortNames[13] = "dao";
        shortNames[14] = "defi";
        
        controller.reserveNames(shortNames);
        console.log("Reserved short names:", shortNames.length);
        
        // ============ Potentially Offensive/Problematic Names ============
        string[] memory blockedNames = new string[](5);
        blockedNames[0] = "admin";
        blockedNames[1] = "root";
        blockedNames[2] = "system";
        blockedNames[3] = "support";
        blockedNames[4] = "official";
        
        controller.reserveNames(blockedNames);
        console.log("Reserved blocked names:", blockedNames.length);
        
        vm.stopBroadcast();
        
        console.log("\n=== RESERVATION COMPLETE ===");
        console.log("Total names reserved:", brandNames.length + protocolNames.length + shortNames.length + blockedNames.length);
        console.log("============================\n");
    }
}

/**
 * @title RegisterReservedName
 * @notice Register a single reserved name to an address
 * 
 * Usage:
 *   CONTROLLER=0x... NAME=selendra OWNER=0x... forge script script/ReserveNames.s.sol:RegisterReservedName \
 *     --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy
 */
contract RegisterReservedName is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address controllerAddress = vm.envAddress("CONTROLLER");
        string memory name = vm.envString("NAME");
        address owner = vm.envAddress("OWNER");
        address resolver = vm.envOr("RESOLVER", address(0));
        uint256 duration = vm.envOr("DURATION", uint256(365 days * 10)); // Default 10 years
        
        SELRegistrarController controller = SELRegistrarController(controllerAddress);
        
        console.log("Registering reserved name:");
        console.log("  Name:", name);
        console.log("  Owner:", owner);
        console.log("  Duration:", duration / 365 days, "years");
        
        vm.startBroadcast(deployerPrivateKey);
        
        controller.registerReserved(name, owner, duration, resolver);
        
        vm.stopBroadcast();
        
        console.log("\nSuccessfully registered:", string.concat(name, ".sel"));
    }
}

/**
 * @title CheckReserved
 * @notice Check if names are reserved (view only, no gas)
 * 
 * Usage:
 *   CONTROLLER=0x... forge script script/ReserveNames.s.sol:CheckReserved --rpc-url $RPC_URL
 */
contract CheckReserved is Script {
    function run() external view {
        address controllerAddress = vm.envAddress("CONTROLLER");
        SELRegistrarController controller = SELRegistrarController(controllerAddress);
        
        string[10] memory namesToCheck = [
            "selendra",
            "bitriel",
            "alice",
            "bob",
            "eth",
            "admin",
            "test",
            "hello",
            "world",
            "sns"
        ];
        
        console.log("Checking reserved status for names:");
        console.log("Controller:", controllerAddress);
        console.log("-----------------------------------");
        
        for (uint256 i = 0; i < namesToCheck.length; i++) {
            bool reserved = controller.isReserved(namesToCheck[i]);
            bool available = controller.available(namesToCheck[i]);
            console.log(namesToCheck[i]);
            console.log("  Reserved:", reserved);
            console.log("  Available:", available);
        }
    }
}

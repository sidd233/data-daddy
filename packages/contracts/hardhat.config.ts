import { defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },
  networks: {
  hardhat: {
    type: "edr-simulated",
  },
  localhost: {
    type: "http",
    url: "http://127.0.0.1:8545",
  },
  baseSepolia: {
    type: "http",
    url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
    chainId: 84532,
  },
},
});
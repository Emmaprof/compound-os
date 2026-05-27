import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Google-Standard Monorepo Fix for ESM (Next.js) environments
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Enterprise gas optimization
      },
    },
  },
  networks: {
    base: {
      url: process.env.BASE_MAINNET_RPC || "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
    }
  },
  // --- THE ETHERSCAN V2 UPGRADE ---
  etherscan: {
    // V2 requires a single Etherscan Master Key as a string, not a nested object.
    apiKey: process.env.ETHERSCAN_API_KEY || "", 
  },
  sourcify: {
    enabled: false // Mutes the deprecated terminal warning
  }
};

export default config;
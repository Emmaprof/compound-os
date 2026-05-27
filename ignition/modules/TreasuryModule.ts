import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Base Mainnet Native USDC Contract Address
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// TODO: Replace this with the wallet address of your Supabase Edge Function!
const SUPABASE_RELAYER_ADDRESS = "0xd7A7778e164a47044A6c6AcD5e4729e7791Ad3B2"; 

const TreasuryModule = buildModule("CompoundOSTreasuryModule", (m) => {
  // Inject the required constructor arguments into the Glass Safe
  const treasury = m.contract("CompoundOSTreasury", [
    BASE_USDC_ADDRESS,
    SUPABASE_RELAYER_ADDRESS
  ]);

  return { treasury };
});

export default TreasuryModule;
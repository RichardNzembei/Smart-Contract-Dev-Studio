import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DevStudioModule", (m) => {
  const devStudio = m.contract("DevStudio");

  return { devStudio };
});

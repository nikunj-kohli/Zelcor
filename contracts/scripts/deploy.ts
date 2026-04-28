import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ZelcorEscrow contract...");

  const ZelcorEscrow = await ethers.getContractFactory("ZelcorEscrow");
  const contract = await ZelcorEscrow.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ Contract deployed to: ${address}`);
  console.log(`\n📋 Add this to your .env file:`);
  console.log(`CONTRACT_ADDRESS=${address}`);

  // Verify network
  const network = await ethers.provider.getNetwork();
  console.log(`\n🌐 Network: ${network.name} (chainId: ${network.chainId})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEncryptedHireForm = await deploy("EncryptedHireForm", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedHireForm contract: `, deployedEncryptedHireForm.address);
};
export default func;
func.id = "deploy_EncryptedHireForm"; // id required to prevent reexecution
func.tags = ["EncryptedHireForm"];

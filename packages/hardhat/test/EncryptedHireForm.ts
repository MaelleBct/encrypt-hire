import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedHireForm, EncryptedHireForm__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { toUtf8Bytes, hexlify } from "ethers";

type Signers = {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedHireForm")) as EncryptedHireForm__factory;
  const contract = (await factory.deploy()) as EncryptedHireForm;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("EncryptedHireForm", function () {
  let s: Signers;
  let contract: EncryptedHireForm;
  let address: string;

  before(async function () {
    const signers = await ethers.getSigners();
    s = { owner: signers[0], alice: signers[1], bob: signers[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.log("⚠️  This suite requires FHEVM mock");
      this.skip();
    }
    ({ contract, address } = await deployFixture());
  });

  it("should allow candidate to upload and retrieve decrypted 'ABCD'", async function () {
    const plain = "ABCD";
    const num = stringToUint32BigInt(plain);

    const enc = await fhevm.createEncryptedInput(address, s.alice.address).add32(num).encrypt();

    await contract.connect(s.alice).uploadResponse(enc.handles[0], enc.inputProof);

    expect(await contract.hasResponse(s.alice.address)).to.eq(true);

    const stored = await contract.viewEncryptedResponse(s.alice.address);
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, stored, address, s.alice);

    const result = uint32BigIntToString(decrypted);
    expect(result).to.eq(plain);
  });

  it("should reject duplicate uploads from same user", async function () {
    const enc1 = await fhevm
      .createEncryptedInput(address, s.alice.address)
      .add32(stringToUint32BigInt("AAAA"))
      .encrypt();

    await contract.connect(s.alice).uploadResponse(enc1.handles[0], enc1.inputProof);

    const enc2 = await fhevm
      .createEncryptedInput(address, s.alice.address)
      .add32(stringToUint32BigInt("BBBB"))
      .encrypt();

    await expect(contract.connect(s.alice).uploadResponse(enc2.handles[0], enc2.inputProof)).to.be.revertedWith(
      "Response already exists",
    );
  });

  it("should let multiple candidates submit independent answers", async function () {
    const aliceInput = await fhevm
      .createEncryptedInput(address, s.alice.address)
      .add32(stringToUint32BigInt("ABCD"))
      .encrypt();
    const bobInput = await fhevm
      .createEncryptedInput(address, s.bob.address)
      .add32(stringToUint32BigInt("WXYZ"))
      .encrypt();

    await contract.connect(s.alice).uploadResponse(aliceInput.handles[0], aliceInput.inputProof);
    await contract.connect(s.bob).uploadResponse(bobInput.handles[0], bobInput.inputProof);

    const aliceStored = await contract.viewEncryptedResponse(s.alice.address);
    const bobStored = await contract.viewEncryptedResponse(s.bob.address);

    const alicePlain = uint32BigIntToString(
      await fhevm.userDecryptEuint(FhevmType.euint32, aliceStored, address, s.alice),
    );
    const bobPlain = uint32BigIntToString(await fhevm.userDecryptEuint(FhevmType.euint32, bobStored, address, s.bob));

    expect(alicePlain).to.eq("ABCD");
    expect(bobPlain).to.eq("WXYZ");
  });

  it("should produce unique ciphertexts for identical text from different users", async function () {
    const msg = "ABCD";
    const val = stringToUint32BigInt(msg);

    const encA = await fhevm.createEncryptedInput(address, s.alice.address).add32(val).encrypt();
    const encB = await fhevm.createEncryptedInput(address, s.bob.address).add32(val).encrypt();

    await contract.connect(s.alice).uploadResponse(encA.handles[0], encA.inputProof);
    await contract.connect(s.bob).uploadResponse(encB.handles[0], encB.inputProof);

    const resA = await contract.viewEncryptedResponse(s.alice.address);
    const resB = await contract.viewEncryptedResponse(s.bob.address);

    expect(resA).to.not.eq(resB);
  });

  it("should keep same encrypted value between reads", async function () {
    const msg = "TEST";
    const enc = await fhevm.createEncryptedInput(address, s.alice.address).add32(stringToUint32BigInt(msg)).encrypt();

    await contract.connect(s.alice).uploadResponse(enc.handles[0], enc.inputProof);

    const first = await contract.viewEncryptedResponse(s.alice.address);
    const second = await contract.viewEncryptedResponse(s.alice.address);

    expect(first).to.eq(second);
  });

  it("should return false for non-submitted address", async function () {
    expect(await contract.hasResponse(s.bob.address)).to.eq(false);
  });
});

/**
 * Convert short string (e.g. "ABCD") to uint32-compatible bigint.
 * Each char = 1 byte (UTF-8). We take max 4 chars because uint32 = 4 bytes.
 */
function stringToUint32BigInt(str: string): bigint {
    const bytes = toUtf8Bytes(str);
    let hex = hexlify(bytes).replace(/^0x/, "");
    // limit to 4 bytes (8 hex chars)
    if (hex.length > 8) hex = hex.slice(0, 8);
    return BigInt("0x" + hex);
  }
  
  /**
   * Convert uint32 bigint back to string.
   */
  function uint32BigIntToString(bn: bigint): string {
    let hex = bn.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    return Buffer.from(hex, "hex").toString("utf8");
  }
  
const PowerfulERC20 = artifacts.require("PowerfulERC20");
const ServiceReceiver = artifacts.require("ServiceReceiver");
const ERC20Mock = artifacts.require("ERC20Mock");
const { assert } = require("chai");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const hardCappedSupply = new BN(1_000_000_000);
const initialSupply = new BN(750_000_000);
const decimal = 18;
const serviceFee = 10000;
const minterRole = web3.utils.soliditySha3("MINTER");

contract("PowerfulERC20", async (accounts) => {
  let fabric;
  let feeReciever;
  const [owner, user, ...rest] = accounts;

  describe("contract deployment", async () => {
    before(async () => {
      
      [feeReciever, fabric] = await Promise.all([
        ServiceReceiver.deployed(),
        PowerfulERC20.deployed(),
      ]);
    });

    it("supports erc1363 interface", async () => {
      assert.equal(await fabric.supportsInterface("0x01ffc9a7"), true);
    })

    it("should have max cap of 1b", async () => {
      const cap = await fabric.cap();
      assert.equal(cap.toString(), "1000000000");
      await expectRevert(
        fabric.mint(owner, new BN("250000001"), { from: owner }),
        "ERC20Capped: cap exceeded"
      );
    });

    it("owner initial balance & token decimals", async () => {
      const balance = await fabric.balanceOf(owner);
      assert.equal(balance.toString(), "750000000");

      assert.equal((await fabric.decimals()).toString(), "18");
    });

    it("service fee is set & can be withdrawn by owner", async () => {
      const serviceFeeAmount = await feeReciever.getPrice("Fabric");
      assert.equal(serviceFeeAmount.toString(), serviceFee.toString());

      await expectRevert(
        feeReciever.withdraw(serviceFeeAmount, { from: user }),
        "Ownable: caller is not the owner"
      );
      await feeReciever.withdraw(serviceFeeAmount, { from: owner });
    });

    it("owner has minter role & can grant others", async () => {
      const ownerIsMinter = await fabric.hasRole(minterRole, owner);
      assert.equal(ownerIsMinter, true, "Owner does not have minter role");

      await expectRevert(
        fabric.mint(user, 10000, { from: user }),
        "Roles: caller does not have the MINTER role"
      );

      const userBefore = await fabric.hasRole(minterRole, user);
      await fabric.grantRole(minterRole, user);
      const userAfter = await fabric.hasRole(minterRole, user);
      assert.equal(
        userBefore,
        false,
        "User has minter role before being assigned"
      );
      assert.equal(userAfter, true, "User was not granted minter role");
    });

    it("user can mint tokens", async () => {
      const initBalance = await fabric.balanceOf(user);
      assert.equal(initBalance.toString(), "0");
      await fabric.mint(user, 10000, { from: user });
      const afterBalance = await fabric.balanceOf(user);
      assert.equal(afterBalance.toString(), "10000");
    });

    it("should recover lost erc20 tokens", async () => {
      const amount = 1000;
      const mock = await ERC20Mock.new("Mock", "MCK", fabric.address, amount, {
        from: owner,
      });

      assert.equal(
        (await mock.balanceOf(fabric.address)).toString(),
        amount.toString()
      );
      assert.equal((await mock.balanceOf(owner)).toString(), "0");

      await expectRevert(
        fabric.recoverERC20(mock.address, amount, { from: user }),
        "Ownable: caller is not the owner"
      );
      await fabric.recoverERC20(mock.address, amount, { from: owner });

      assert.equal((await mock.balanceOf(fabric.address)).toString(), "0");
      assert.equal((await mock.balanceOf(owner)).toString(), amount.toString());
    });

    it("cannot mint after finishMinting is called", async () => {
      assert.equal(await fabric.mintingFinished(), false);
      await fabric.finishMinting({ from: owner });
      await expectRevert(
        fabric.mint(user, 10000, { from: user }),
        "ERC20Mintable: minting is finished"
      );
      await expectRevert(
        fabric.mint(user, 10000, { from: owner }),
        "ERC20Mintable: minting is finished"
      );

      assert.equal(await fabric.mintingFinished(), true);
    });
  });
});

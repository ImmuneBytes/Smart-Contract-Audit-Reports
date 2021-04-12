const { expect } = require("chai");
const { accounts, contract } = require("@openzeppelin/test-environment");
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectRevert, // Assertions for transactions that should fail
  time
} = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;

const UniqToken = contract.fromArtifact("UniqToken");
const UniqVesting = contract.fromArtifact("UniqVestingMock");

describe("UniqVesting", function () {
  const [
    owner,
    newOwner,
    investor1,
    investor2,
    investor3,
    investor4,
    investor5
  ] = accounts;

  var currentTime;
  var startTime;

  beforeEach(async function () {
    currentTime = await time.latest();
    startTime = Number(currentTime) + Number(time.duration.minutes(5));

    this.token = await UniqToken.new(new BN(1000000), { from: owner });

    this.presale1 = await UniqToken.new(new BN(10000), { from: investor1 });
    this.presale2 = await UniqToken.new(new BN(10000), { from: investor2 });
    this.presale3 = await UniqToken.new(new BN(10000), { from: investor3 });

    this.vesting = await UniqVesting.new(
      this.token.address,
      [this.presale1.address, this.presale2.address, this.presale3.address],
      [1, 2, 3],
      startTime,
      {
        from: owner
      }
    );
  });

  describe("initialize()", function () {
    it("Should initialize properly", async function () {
      const startDate = await this.vesting.dateStart();
      expect(startDate).to.be.bignumber.equal(startTime.toString());

      const token = await this.vesting.token();
      expect(token).to.equal(this.token.address);

      const presale1 = await this.vesting.presales(0);
      expect(presale1).to.equal(this.presale1.address);

      const presale2 = await this.vesting.presales(1);
      expect(presale2).to.equal(this.presale2.address);

      const presale3 = await this.vesting.presales(2);
      expect(presale3).to.equal(this.presale3.address);

      const rate1 = await this.vesting.rates(0);
      expect(rate1).to.be.bignumber.equal(new BN(1));

      const rate2 = await this.vesting.rates(1);
      expect(rate2).to.be.bignumber.equal(new BN(2));

      const rate3 = await this.vesting.rates(2);
      expect(rate3).to.be.bignumber.equal(new BN(3));

      const currentOwner = await this.vesting.owner();
      expect(currentOwner).to.equal(owner);
    });
  });

  describe("calc()", function () {
    beforeEach(async function () {
      await this.presale1.transfer(investor2, new BN(2000), { from: investor1 });
      await this.presale1.transfer(investor3, new BN(3000), { from: investor1 });

      await this.presale2.transfer(investor1, new BN(2000), { from: investor2 });
      await this.presale2.transfer(investor3, new BN(3000), { from: investor2 });

      await this.presale3.transfer(investor1, new BN(2000), { from: investor3 });
      await this.presale3.transfer(investor2, new BN(3000), { from: investor3 });
    });

    it("Should be able to calculate and store total tokens without withdrawing for investor1", async function () {
      await this.vesting.calc({ from: investor1 });

      const tokensTotal = await this.vesting.tokensTotal(investor1);
      expect(tokensTotal).to.be.bignumber.equal(new BN(15000));

      const initialized = await this.vesting.initialized(investor1);
      expect(initialized).to.equal(true);

      const withdrawn = await this.vesting.pctWithdrawn(investor1);
      expect(withdrawn).to.be.bignumber.equal(new BN(0));
    });

    it("Should be able to calculate and store total tokens without withdrawing for investor2", async function () {
      await this.vesting.calc({ from: investor2 });

      const tokensTotal = await this.vesting.tokensTotal(investor2);
      expect(tokensTotal).to.be.bignumber.equal(new BN(21000));

      const initialized = await this.vesting.initialized(investor2);
      expect(initialized).to.equal(true);

      const withdrawn = await this.vesting.pctWithdrawn(investor2);
      expect(withdrawn).to.be.bignumber.equal(new BN(0));
    });

    it("Should be able to calculate and store total tokens without withdrawing for investor3", async function () {
      await this.vesting.calc({ from: investor3 });

      const tokensTotal = await this.vesting.tokensTotal(investor3);
      expect(tokensTotal).to.be.bignumber.equal(new BN(24000));

      const initialized = await this.vesting.initialized(investor3);
      expect(initialized).to.equal(true);

      const withdrawn = await this.vesting.pctWithdrawn(investor3);
      expect(withdrawn).to.be.bignumber.equal(new BN(0));
    });

    it("Should not be able to call calc more than once for a single investor", async function () {
      await this.vesting.calc({ from: investor1 });

      await expectRevert(
        this.vesting.calc({ from: investor1 }),
        "Account already initialized"
      );
    });
  });

  describe("claim()", function () {
    beforeEach(async function () {
      await this.presale1.transfer(investor2, new BN(2000), { from: investor1 });
      await this.presale1.transfer(investor3, new BN(3000), { from: investor1 });

      await this.presale2.transfer(investor1, new BN(2000), { from: investor2 });
      await this.presale2.transfer(investor3, new BN(3000), { from: investor2 });

      await this.presale3.transfer(investor1, new BN(2000), { from: investor3 });
      await this.presale3.transfer(investor2, new BN(3000), { from: investor3 });

      await this.token.transfer(this.vesting.address, new BN(100000), { from: owner });
    });

    it("Should not be able to claim if we haven't reached startDate", async function () {
      await expectRevert(
        this.vesting.claim({ from: investor1 }),
        "Initial vesting in progress"
      );
    });

    it("Should be able to claim once we reach startDate with no bonus", async function () {
      const period1 = Number(startTime) + Number(time.duration.seconds(10)); // First vesting period
      await time.increaseTo(period1);

      const initialBalance = await this.token.balanceOf(investor2);
      expect(initialBalance).to.be.bignumber.equal(new BN(0));

      await this.vesting.claim({ from: investor2 }); // Should withdraw 20% in first vesting period

      const balance = await this.token.balanceOf(investor2);
      expect(balance).to.be.bignumber.equal(new BN(4200)); // 20% of 21000 = 4200

      const withdrawn = await this.vesting.pctWithdrawn(investor2);
      expect(withdrawn).to.be.bignumber.equal(new BN(20));

      const bonus = await this.vesting.bonus(investor2);
      expect(bonus).to.be.bignumber.equal(new BN(0));
    });

    it("Should be able to claim with a bonus after 10 vesting periods pass only if investor has claimed no more than 20% before", async function () {
      const period11 = Number(startTime) + Number(time.duration.minutes(10)) + Number(time.duration.seconds(10)); // 11th vesting period

      await time.increaseTo(period11);

      var balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(0));

      await this.vesting.claim({ from: investor1 }); // Should withdraw 60% in eleventh vesting period

      balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(9000)); // 60% of 15000 = 9000

      const withdrawn = await this.vesting.pctWithdrawn(investor1);
      expect(withdrawn).to.be.bignumber.equal(new BN(60));

      const bonus = await this.vesting.bonus(investor1);
      expect(bonus).to.be.bignumber.equal(new BN(1));
    });

    it("Should be able to claim without a bonus after 10 vesting periods pass if investor has claimed more than 20% before", async function () {
      const period2 = Number(startTime) + Number(time.duration.minutes(1)) + Number(time.duration.seconds(10)); // Second vesting period
      const period11 = Number(startTime) + Number(time.duration.minutes(10)) + Number(time.duration.seconds(10)); // 11th vesting period

      await time.increaseTo(period2);

      var balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(0));

      await this.vesting.claim({ from: investor1 }); // Should withdraw 24% in second vesting period

      balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(3600)); // 24% of 15000 = 3600

      await time.increaseTo(period11);

      await this.vesting.claim({ from: investor1 }); // Should withdraw 36% more in eleventh vesting period

      balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(9000)); // 24%(3600) initially withdrawn + 36%(5400) now of 15000 = 9000

      const withdrawn = await this.vesting.pctWithdrawn(investor1);
      expect(withdrawn).to.be.bignumber.equal(new BN(60));

      const bonus = await this.vesting.bonus(investor1);
      expect(bonus).to.be.bignumber.equal(new BN(0));
    });

    it("Should be able to claim with a bonus after 20 vesting periods pass if investor has claimed no more than 20% before", async function () {
      const period1 = Number(startTime) + Number(time.duration.seconds(10)); // First vesting period
      const period21 = Number(startTime) + Number(time.duration.minutes(20)) + Number(time.duration.seconds(10)); // Vesting period over

      await time.increaseTo(period1);

      var balance = await this.token.balanceOf(investor3);
      expect(balance).to.be.bignumber.equal(new BN(0));

      await this.vesting.claim({ from: investor3 }); // Should withdraw 20% in second vesting period

      balance = await this.token.balanceOf(investor3);
      expect(balance).to.be.bignumber.equal(new BN(4800)); // 20% of 24000 = 4800

      await time.increaseTo(period21);

      await this.vesting.claim({ from: investor3 }); // Should withdraw 80% more after vesting period is over

      balance = await this.token.balanceOf(investor3);
      expect(balance).to.be.bignumber.equal(new BN(24000)); // 20%(4800) initially withdrawn + 80%(19200) now of 24000 = 24000

      const withdrawn = await this.vesting.pctWithdrawn(investor3);
      expect(withdrawn).to.be.bignumber.equal(new BN(100));

      const bonus = await this.vesting.bonus(investor3);
      expect(bonus).to.be.bignumber.equal(new BN(2));
    });

    it("Should be able to claim without a bonus after 20 vesting periods pass if investor has claimed more than 20% before", async function () {
      const period11 = Number(startTime) + Number(time.duration.minutes(10)) + Number(time.duration.seconds(10)); // Eleventh vesting period
      const period21 = Number(startTime) + Number(time.duration.minutes(20)) + Number(time.duration.seconds(10)); // Vesting period over

      await time.increaseTo(period11);

      var balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(0));

      await this.vesting.claim({ from: investor1 }); // Should withdraw 24% in second vesting period

      balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(9000)); // 60% of 15000 = 9000

      await time.increaseTo(period21);

      await this.vesting.claim({ from: investor1 }); // Should withdraw remaining claim amount(6000) after vesting period is over

      balance = await this.token.balanceOf(investor1);
      expect(balance).to.be.bignumber.equal(new BN(15000)); // 60%(9000) initially withdrawn + 40%(6000) now of 15000 = 15000

      const withdrawn = await this.vesting.pctWithdrawn(investor1);
      expect(withdrawn).to.be.bignumber.equal(new BN(100));

      const bonus = await this.vesting.bonus(investor1);
      expect(bonus).to.be.bignumber.equal(new BN(1));
    });
  });

  describe("giveOwnership()/acceptOwnership()", function () {

    it("Should be able to propose new owner", async function () {
      await this.vesting.giveOwnership(newOwner, { from: owner });

      const currentOwner = await this.vesting.owner();
      expect(currentOwner).to.equal(owner);

      const proposedOwner = await this.vesting.newOwner();
      expect(proposedOwner).to.equal(newOwner);
    });

    it("Should be able to accept ownership", async function () {
      await this.vesting.giveOwnership(newOwner, { from: owner });

      var currentOwner = await this.vesting.owner();
      expect(currentOwner).to.equal(owner);

      var proposedOwner = await this.vesting.newOwner();
      expect(proposedOwner).to.equal(newOwner);

      await this.vesting.acceptOwnership({ from: newOwner });

      currentOwner = await this.vesting.owner();
      expect(currentOwner).to.equal(newOwner);

      proposedOwner = await this.vesting.newOwner();
      expect(proposedOwner).to.equal(ZERO_ADDRESS);
    });

    it("Should not be able to propose new owner if not called by current owner", async function () {
      await expectRevert(
        this.vesting.giveOwnership(newOwner, { from: investor1 }),
        "Only for Owner"
      );
    });

    it("Should not be able to accept ownership if not called by proposed owner", async function () {
      await this.vesting.giveOwnership(newOwner, { from: owner });

      var currentOwner = await this.vesting.owner();
      expect(currentOwner).to.equal(owner);

      var proposedOwner = await this.vesting.newOwner();
      expect(proposedOwner).to.equal(newOwner);

      await expectRevert(
        this.vesting.acceptOwnership({ from: investor1 }),
        "Ure not New Owner"
      );
    });
  });

  describe("addInvestor()/addInvestors()", function () {

    it("Should be able to add investor", async function () {
      await this.vesting.addInvestor(investor4, new BN(10000), { from: owner });

      const tokensTotal = await this.vesting.tokensTotal(investor4);
      expect(tokensTotal).to.be.bignumber.equal(new BN(10000));
    });

    it("Should be able to add multiple investors", async function () {
      await this.vesting.addInvestors([investor4, investor5], [new BN(10000), new BN(20000)], { from: owner });

      const tokensTotal1 = await this.vesting.tokensTotal(investor4);
      expect(tokensTotal1).to.be.bignumber.equal(new BN(10000));

      const tokensTotal2 = await this.vesting.tokensTotal(investor5);
      expect(tokensTotal2).to.be.bignumber.equal(new BN(20000));
    });

    it("Should not be able to add investor if not called by owner", async function () {
      await expectRevert(
        this.vesting.addInvestor(investor4, new BN(10000), { from: investor1 }),
        "Only for Owner"
      );
    });

    it("Should not be able to add multiple investors if not called by owner", async function () {
      await expectRevert(
        this.vesting.addInvestors(
          [investor4, investor5],
          [new BN(10000), new BN(20000)],
          { from: investor1 }),
        "Only for Owner"
      );
    });

    it("Should not be able to add multiple investors if array lengths don't match", async function () {
      await expectRevert(
        this.vesting.addInvestors(
          [investor4, investor5],
          [new BN(10000)],
          { from: owner }),
        "Data length not math"
      );
    });
  });

  describe("rescueERC20()", function () {
    beforeEach(async function () {
      this.rescueToken = await UniqToken.new(new BN(10000), { from: investor5 });
    });

    it("Should be able to rescue token", async function () {
      await this.rescueToken.transfer(this.vesting.address, new BN(1000), { from: investor5 });

      var balance = await this.rescueToken.balanceOf(owner);
      expect(balance).to.be.bignumber.equal(new BN(0));

      await this.vesting.rescueERC20(this.rescueToken.address, { from: owner });

      balance = await this.rescueToken.balanceOf(owner);
      expect(balance).to.be.bignumber.equal(new BN(1000));
    });

    it("Should not be able to rescue token if not called by owner", async function () {
      await this.rescueToken.transfer(this.vesting.address, new BN(1000), { from: investor5 });

      await expectRevert(
        this.vesting.rescueERC20(
          this.rescueToken.address,
          { from: investor1 }),
        "Only for Owner"
      );
    });

    it("Should not be able to rescue token if there is nothing to rescue", async function () {
      await expectRevert(
        this.vesting.rescueERC20(
          this.rescueToken.address,
          { from: owner }),
        "Nothing to rescue"
      );
    });
  });
});

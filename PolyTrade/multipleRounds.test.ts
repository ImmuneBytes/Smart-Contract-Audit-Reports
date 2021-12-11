import { expect } from "chai";
import { ethers } from "hardhat";

// eslint-disable-next-line node/no-missing-import
import { increaseTime, n18, n6, ONE_DAY } from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IERC20,
  IUniswapV2Router,
  LenderPool,
  LenderPool__factory,
  // eslint-disable-next-line node/no-missing-import
} from "../typechain";
import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import {
  quickswapRouterAddress,
  TradeAddress,
  USDCAddress,
  WMaticAddress,
  // eslint-disable-next-line node/no-missing-import
} from "./constants/constants.helpers";

describe("LenderPool - Multiple Rounds", function () {
  let lenderPool: LenderPool;

  // eslint-disable-next-line camelcase
  let LenderPoolFactory: LenderPool__factory;
  let USDCContract: IERC20;
  let tradeContract: IERC20;
  let accounts: SignerWithAddress[];
  let addresses: string[];
  let quickswapRouter: IUniswapV2Router;
  let timestamp: number;

  before(async () => {
    accounts = await ethers.getSigners();
    addresses = accounts.map((account: SignerWithAddress) => account.address);
  });

  beforeEach(async () => {
    timestamp = (await ethers.provider.getBlock(ethers.provider.blockNumber))
      .timestamp;
  });

  it("Should return the Trade Token", async function () {
    tradeContract = await ethers.getContractAt(
      "IERC20",
      TradeAddress,
      accounts[10]
    );

    expect(
      await ethers.provider.getCode(tradeContract.address)
    ).to.be.length.above(100);
  });

  it("Should return the USDC Token", async function () {
    USDCContract = await ethers.getContractAt(
      "IERC20",
      USDCAddress,
      accounts[10]
    );

    expect(
      await ethers.provider.getCode(USDCContract.address)
    ).to.be.length.above(100);
  });

  it("Should buy USDC on quickswap", async () => {
    quickswapRouter = await ethers.getContractAt(
      "IUniswapV2Router",
      quickswapRouterAddress,
      accounts[10]
    );

    const path: string[] = [WMaticAddress, USDCAddress];

    for (let i = 0; i < 10; i++) {
      await quickswapRouter
        .connect(accounts[i])
        .swapExactETHForTokens(
          0,
          path,
          addresses[10],
          timestamp + 365 * ONE_DAY,
          {
            value: n18("10000"),
          }
        );
      console.log(
        formatUnits(await USDCContract.balanceOf(addresses[10]), "6")
      );
    }
  });

  it("Should distribute USDC to 10 different addresses", async () => {
    const amount = n6("5000");
    for (let i = 1; i <= 10; i++) {
      await USDCContract.transfer(addresses[i], amount);
    }
  });

  describe("LenderPool - 1 - StableAPY: 10%, USDC, minDeposit: 100 USDC", () => {
    it("Should return the LenderPool once it's deployed", async function () {
      LenderPoolFactory = await ethers.getContractFactory("LenderPool");
      lenderPool = await LenderPoolFactory.deploy(USDCContract.address, "1000");
      await lenderPool.deployed();
      expect(
        await ethers.provider.getCode(lenderPool.address)
      ).to.be.length.above(100);
      await USDCContract.transfer(lenderPool.address, n6("10000"));
    });

    it("Should set the minimum deposit to 100 USDC", async () => {
      await lenderPool.setMinimumDeposit(n6("100"));
    });

    it("Should approve MAX UINT for user1", async (user: number = 1) => {
      await USDCContract.connect(accounts[user]).approve(
        lenderPool.address,
        ethers.constants.MaxUint256
      );

      expect(
        await USDCContract.allowance(addresses[user], lenderPool.address)
      ).to.equal(ethers.constants.MaxUint256);
    });

    it("Should fail running a new round (0) with lower amount", async (user: number = 1) => {
      await expect(
        lenderPool.newRound(addresses[user], n6("10"), "1000", 60, false)
      ).to.be.revertedWith("Amount lower than minimumDeposit");
    });

    it("Should run new round (0)", async (user: number = 1) => {
      await lenderPool.newRound(addresses[user], n6("100"), "1000", 60, false);
      const round = await lenderPool.getRound(addresses[user], 0);
      expect(round.amountLent).to.equal(n6("100"));
      expect(round.bonusAPY).to.equal(1000);
      expect(round.paidTrade).to.equal(false);
    });

    it("Should return the number of rounds after new round (0)", async (user: number = 1) => {
      expect(await lenderPool.getNumberOfRounds(addresses[user])).to.equal(1);
    });

    it("Should return the total amount lent (0)", async (user: number = 1) => {
      expect(await lenderPool.getAmountLent(addresses[user])).to.equal(
        n6("100")
      );
    });

    it("Should run new round (1)", async (user: number = 1) => {
      await lenderPool.newRound(addresses[user], n6("110"), "1100", 120, false);
      const round = await lenderPool.getRound(addresses[user], 1);
      expect(round.amountLent).to.equal(n6("110"));
      expect(round.bonusAPY).to.equal(1100);
      expect(round.paidTrade).to.equal(false);
    });

    it("Should return the number of rounds after new round (1)", async (user: number = 1) => {
      expect(await lenderPool.getNumberOfRounds(addresses[user])).to.equal(2);
    });

    it("Should return the total amount lent (1)", async (user: number = 1) => {
      expect(await lenderPool.getAmountLent(addresses[user])).to.equal(
        n6("210")
      );
    });

    it("Should run new round (2)", async (user: number = 1) => {
      await lenderPool.newRound(addresses[user], n6("120"), "1200", 30, true);
      const round = await lenderPool.getRound(addresses[user], 2);
      expect(round.amountLent).to.equal(n6("120"));
      expect(round.bonusAPY).to.equal(1200);
      expect(round.paidTrade).to.equal(true);
    });

    it("Should return the number of rounds after new round (2)", async (user: number = 1) => {
      expect(await lenderPool.getNumberOfRounds(addresses[user])).to.equal(3);
    });

    it("Should return the total amount lent (2)", async (user: number = 1) => {
      expect(await lenderPool.getAmountLent(addresses[user])).to.equal(
        n6("330")
      );
    });

    it("Should run new round (3)", async (user: number = 1) => {
      await lenderPool.newRound(addresses[user], n6("130"), "1300", 90, true);
      const round = await lenderPool.getRound(addresses[user], 3);
      expect(round.amountLent).to.equal(n6("130"));
      expect(round.bonusAPY).to.equal(1300);
      expect(round.paidTrade).to.equal(true);
    });

    it("Should return the number of rounds after new round (3)", async (user: number = 1) => {
      expect(await lenderPool.getNumberOfRounds(addresses[user])).to.equal(4);
    });

    it("Should return the total amount lent (3)", async (user: number = 1) => {
      expect(await lenderPool.getAmountLent(addresses[user])).to.equal(
        n6("460")
      );
    });

    it("Should run new round (4)", async (user: number = 1) => {
      await lenderPool.newRound(addresses[user], n6("140"), "1400", 150, true);
      const round = await lenderPool.getRound(addresses[user], 4);
      expect(round.amountLent).to.equal(n6("140"));
      expect(round.bonusAPY).to.equal(1400);
      expect(round.paidTrade).to.equal(true);
    });

    it("Should return the number of rounds after new round (4)", async (user: number = 1) => {
      expect(await lenderPool.getNumberOfRounds(addresses[user])).to.equal(5);
    });

    it("Should return the total amount lent (4)", async (user: number = 1) => {
      expect(await lenderPool.getAmountLent(addresses[user])).to.equal(
        n6("600")
      );
    });

    it("Should return rewards after 10 days (round 0)", async (user: number = 1) => {
      const rounds = await lenderPool.getNumberOfRounds(addresses[user]);
      for (let i = 0; i < 10; i++) {
        for (let i = BigNumber.from(0); i < rounds; i = i.add(1)) {
          const stable = await lenderPool.stableRewardOf(addresses[user], 0);
          const bonus = await lenderPool.bonusRewardOf(addresses[user], 0);
          const total = await lenderPool.totalRewardOf(addresses[user], 0);
          expect(total).to.equal(stable.add(bonus));
        }
        await increaseTime(ONE_DAY);
      }
    });

    it("Should fail to withdraw if before the endPeriod", async (user: number = 1) => {
      await expect(lenderPool.withdraw(addresses[user], 0)).to.be.revertedWith(
        "Round is not finished yet"
      );
    });

    it("Should return all finished rounds with no finished rounds", async (user: number = 1) => {
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(0);
    });

    it("Should return all finished rounds after 10 + 20 days (30 days passed)", async (user: number = 1) => {
      await increaseTime(ONE_DAY * 20);
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(1);
    });

    it("Should return all finished rounds after 30 more days (60 days passed)", async (user: number = 1) => {
      await increaseTime(ONE_DAY * 30);
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(2);
    });

    it("Should return all finished rounds after 30 more days (90 days passed)", async (user: number = 1) => {
      await increaseTime(ONE_DAY * 30);
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(3);
    });

    it("Should return all finished rounds after 30 more days (120 days passed)", async (user: number = 1) => {
      await increaseTime(ONE_DAY * 30);
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(4);
    });

    it("Should return all finished rounds after 30 more days (150 days passed)", async (user: number = 1) => {
      await increaseTime(ONE_DAY * 30);
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(5);
    });

    it("Should return all finished rounds after 30 more days (180 days passed)", async (user: number = 1) => {
      await increaseTime(ONE_DAY * 30);
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(5);
    });

    it("Should withdraw all finished Rounds", async (user: number = 1) => {
      const balanceUSDCBefore = await USDCContract.balanceOf(addresses[user]);
      expect(balanceUSDCBefore).to.equal(n6("4400"));
      const balanceTradeBefore = await tradeContract.balanceOf(addresses[user]);

      await lenderPool.withdrawAllFinishedRounds(addresses[user]);

      const balanceUSDCAfter = await USDCContract.balanceOf(addresses[user]);
      expect(balanceUSDCAfter).to.equal(n6("5005.260273"));

      const balanceTradeAfter = await tradeContract.balanceOf(addresses[user]);
      expect(balanceTradeAfter).to.be.above(balanceTradeBefore);
    });

    it("Should return all finished rounds after withdrawal", async (user: number = 1) => {
      const finishedRounds = await lenderPool.getFinishedRounds(
        addresses[user]
      );
      expect(finishedRounds.length).to.equal(0);
    });
  });
});

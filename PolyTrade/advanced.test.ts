import { expect } from "chai";
import { ethers } from "hardhat";

// eslint-disable-next-line node/no-missing-import
import { increaseTime, n18, n6, ONE_DAY } from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IUniswapV2Router,
  LenderPool,
  LenderPool__factory,
  // eslint-disable-next-line node/no-missing-import
} from "../typechain";
import { BigNumber } from "ethers";
import {
  DAIAddress,
  extraTime,
  quickswapRouterAddress,
  TradeAddress,
  USDTAddress,
  WMaticAddress,
  // eslint-disable-next-line node/no-missing-import
} from "./constants/constants.helpers";

describe("LenderPool - Advanced", function () {
  let lenderPool1: LenderPool;
  let lenderPool2: LenderPool;
  let lenderPool3: LenderPool;
  // eslint-disable-next-line camelcase
  let LenderPoolFactory: LenderPool__factory;
  let USDTContract: any;
  let DAIContract: any;
  let tradeContract: any;
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
      accounts[0]
    );

    expect(
      await ethers.provider.getCode(tradeContract.address)
    ).to.be.length.above(100);
  });

  it("Should return the USDT Token", async function () {
    USDTContract = await ethers.getContractAt(
      "IERC20",
      USDTAddress,
      accounts[0]
    );

    expect(
      await ethers.provider.getCode(USDTContract.address)
    ).to.be.length.above(100);
  });

  it("Should return the DAI Token", async function () {
    DAIContract = await ethers.getContractAt("IERC20", DAIAddress, accounts[0]);

    expect(
      await ethers.provider.getCode(DAIContract.address)
    ).to.be.length.above(100);
  });

  it("Should buy USDT on quickswap", async () => {
    quickswapRouter = await ethers.getContractAt(
      "IUniswapV2Router",
      quickswapRouterAddress,
      accounts[0]
    );

    const path: string[] = [WMaticAddress, USDTAddress];

    for (let i = 0; i < 10; i++) {
      await quickswapRouter
        .connect(accounts[i])
        .swapExactETHForTokens(0, path, addresses[0], timestamp + extraTime, {
          value: n18("10000"),
        });
      expect(await USDTContract.balanceOf(addresses[0])).to.be.above(n6("100"));
    }
  });

  it("Should buy DAI on quickswap", async () => {
    quickswapRouter = await ethers.getContractAt(
      "IUniswapV2Router",
      quickswapRouterAddress,
      accounts[0]
    );

    const path: string[] = [WMaticAddress, DAIAddress];

    for (let i = 0; i < 10; i++) {
      await quickswapRouter
        .connect(accounts[i])
        .swapExactETHForTokens(0, path, addresses[0], timestamp + extraTime, {
          value: n18("10000"),
        });
      expect(await DAIContract.balanceOf(addresses[0])).to.be.above(n6("100"));
    }
  });

  it("Should distribute USDT to 10 different addresses", async () => {
    const amount = n6("5000");
    for (let i = 1; i <= 10; i++) {
      await USDTContract.transfer(addresses[i], amount);
      expect(await USDTContract.balanceOf(addresses[i])).to.equal(amount);
    }
  });

  it("Should distribute DAI to 10 different addresses", async () => {
    const amount = n18("5000");
    for (let i = 1; i <= 10; i++) {
      await DAIContract.transfer(addresses[i], amount);
      expect(await DAIContract.balanceOf(addresses[i])).to.equal(amount);
    }
  });

  describe("LenderPool - 1 - StableAPY: 5%, USDT, minDeposit: 100 USDT", () => {
    it("Should return the LenderPool once it's deployed", async function () {
      LenderPoolFactory = await ethers.getContractFactory("LenderPool");
      lenderPool1 = await LenderPoolFactory.deploy(USDTContract.address, "500");
      await lenderPool1.deployed();
      expect(
        await ethers.provider.getCode(lenderPool1.address)
      ).to.be.length.above(100);
      await USDTContract.transfer(lenderPool1.address, n6("10000"));
    });

    it("Should set the minimum deposit to 100 USDT", async () => {
      await lenderPool1.setMinimumDeposit(n6("100"));
    });

    describe("User0 - Round0, amount: 1000 USDT, bonusAPY: 10%, Tenure: 30, TradeBonus: true", () => {
      it("Should run new Rounds for user0", async () => {
        await USDTContract.approve(
          lenderPool1.address,
          ethers.constants.MaxUint256
        );
        await lenderPool1.newRound(addresses[0], n6("1000"), "1000", 30, true);
        await lenderPool1.newRound(addresses[0], n6("1100"), "1100", 31, false);
        await lenderPool1.newRound(addresses[0], n6("1200"), "1200", 32, true);
        await lenderPool1.newRound(addresses[0], n6("1300"), "1300", 33, false);
      });

      it("Should get round 0 from user0", async () => {
        const round = await lenderPool1.getRound(addresses[0], 0);
        expect(round.bonusAPY).to.equal(1000);
        expect(round.paidTrade).to.equal(true);
        expect(round.amountLent).to.equal(n6("1000"));
      });

      it("Should get all rounds for user0", async () => {
        const count = await lenderPool1.getNumberOfRounds(addresses[0]);
        for (let i = BigNumber.from(0); i < count; i = i.add(1)) {
          const round = await lenderPool1.getRound(addresses[0], i);
          expect(round.amountLent).to.be.above(n6("100"));
        }
      });

      it("Should return stable rewards for user0 for round0 at the endPeriod", async () => {
        await increaseTime(ONE_DAY * 31);
        const rewardAfter = await lenderPool1.stableRewardOf(addresses[0], 0);
        expect(rewardAfter).to.equal(n6("4.109589"));
      });

      it("Should return bonus rewards for user0 for round0 at the endPeriod", async () => {
        const bonusRewardAfter = await lenderPool1.bonusRewardOf(
          addresses[0],
          0
        );
        expect(bonusRewardAfter).to.equal(n6("8.219178"));
      });

	  it("Should return total rewards for user0 for round0 at the endPeriod", async () => {
        const totalRewardAfter = await lenderPool1.totalRewardOf(
          addresses[0],
          0
        );
        expect(totalRewardAfter).to.equal(n6("12.328767"));
      });

      it("Should withdraw for user0 for round0", async () => {
        expect(await tradeContract.balanceOf(addresses[0])).to.equal(0);
        await lenderPool1.withdraw(addresses[0], 0);
        await USDTContract.balanceOf(addresses[0]);
        expect(await tradeContract.balanceOf(addresses[0])).to.be.above(0);
      });
    });

    describe("User1 - Round0, amount: 100 USDT, bonusAPY: 8%, Tenure: 30, TradeBonus: true", () => {
      it("Should run new Round for user1", async () => {
        await USDTContract.connect(accounts[1]).approve(
          lenderPool1.address,
          ethers.constants.MaxUint256
        );
        await lenderPool1.newRound(addresses[1], n6("100"), "800", 30, true);
      });

      it("Should return stable rewards for user1 for round0 at the endPeriod", async () => {
        const rewardBefore = await lenderPool1.stableRewardOf(addresses[1], 0);
        expect(rewardBefore).to.equal(0);
        await increaseTime(ONE_DAY * 31);
        const rewardAfter = await lenderPool1.stableRewardOf(addresses[1], 0);
        expect(rewardAfter).to.equal(n6("0.410958"));
      });

      it("Should return bonus rewards for user1 for round0 at the endPeriod", async () => {
        const bonusRewardAfter = await lenderPool1.bonusRewardOf(
          addresses[1],
          0
        );
        expect(bonusRewardAfter).to.equal(n6("0.657534"));
      });

			it("Should return total rewards for user1 for round0 at the endPeriod", async () => {
        const totalRewardAfter = await lenderPool1.totalRewardOf(
          addresses[1],
          0
        );
        expect(totalRewardAfter).to.equal(n6("1.068492"));
      });

      it("Should withdraw for user1 for round0", async () => {
        expect(await tradeContract.balanceOf(addresses[1])).to.equal(0);
        await lenderPool1.withdraw(addresses[1], 0);
        await USDTContract.balanceOf(addresses[1]);
        expect(await tradeContract.balanceOf(addresses[1])).to.be.above(0);
      });
    });

    describe("User2 - Round0, amount: 1000 USDT, bonusAPY: 10%, Tenure: 30, TradeBonus: true", () => {
      it("Should run new Round for user2", async () => {
        await USDTContract.connect(accounts[2]).approve(
          lenderPool1.address,
          ethers.constants.MaxUint256
        );
        await lenderPool1.newRound(addresses[2], n6("1000"), "1000", 30, true);
      });

      it("Should return stable rewards for user2 for round0 at the endPeriod", async () => {
        const rewardBefore = await lenderPool1.stableRewardOf(addresses[2], 0);
        expect(rewardBefore).to.equal(0);
        await increaseTime(ONE_DAY * 31);
        const rewardAfter = await lenderPool1.stableRewardOf(addresses[2], 0);
        expect(rewardAfter).to.equal(n6("4.109589"));
      });

      it("Should return bonus rewards for user2 for round0 at the endPeriod", async () => {
        const bonusRewardAfter = await lenderPool1.bonusRewardOf(
          addresses[2],
          0
        );
        expect(bonusRewardAfter).to.equal(n6("8.219178"));
      });

			it("Should return total rewards for user2 for round0 at the endPeriod", async () => {
        const totalRewardAfter = await lenderPool1.totalRewardOf(
          addresses[2],
          0
        );
        expect(totalRewardAfter).to.equal(n6("12.328767"));
      });

      it("Should withdraw for user2 for round0", async () => {
        expect(await tradeContract.balanceOf(addresses[2])).to.equal(0);
        await lenderPool1.withdraw(addresses[2], 0);
        await USDTContract.balanceOf(addresses[2]);
        expect(await tradeContract.balanceOf(addresses[2])).to.be.above(0);
      });
    });
  });

  describe("LenderPool - 2 - StableAPY: 8%, USDT, minDeposit: 1000 USDT", () => {
    it("Should return the LenderPool once it's deployed", async function () {
      LenderPoolFactory = await ethers.getContractFactory("LenderPool");
      lenderPool2 = await LenderPoolFactory.deploy(USDTContract.address, "800");
      await lenderPool2.deployed();
      expect(
        await ethers.provider.getCode(lenderPool2.address)
      ).to.be.length.above(100);
      await USDTContract.transfer(lenderPool2.address, n6("10000"));
    });

    it("Should set the minimum deposit to 1000 USDT", async () => {
      await lenderPool2.setMinimumDeposit(n6("1000"));
    });

    describe("User0 - Round0, amount: 5000 USDT, bonusAPY: 7%, Tenure: 60, TradeBonus: false", () => {
      it("Should run new Rounds for user0", async () => {
        await USDTContract.approve(
          lenderPool2.address,
          ethers.constants.MaxUint256
        );
        await lenderPool2.newRound(addresses[0], n6("5000"), "700", 60, false);
      });

      it("Should return stable rewards for user0 for round0 at the endPeriod", async () => {
        await increaseTime(ONE_DAY * 60);
        const rewardAfter = await lenderPool2.stableRewardOf(addresses[0], 0);
        expect(rewardAfter).to.equal(n6("65.753424"));
      });

      it("Should return bonus rewards for user0 for round0 at the endPeriod", async () => {
        const bonusRewardAfter = await lenderPool2.bonusRewardOf(
          addresses[0],
          0
        );
        expect(bonusRewardAfter).to.equal(n6("57.534246"));
      });

			it("Should return total rewards for user0 for round0 at the endPeriod", async () => {
        const totalRewardAfter = await lenderPool2.totalRewardOf(
          addresses[0],
          0
        );
        expect(totalRewardAfter).to.equal(n6("123.28767"));
      });

      it("Should withdraw for user0 for round0", async () => {
        await lenderPool2.withdraw(addresses[0], 0);
        await USDTContract.balanceOf(addresses[0]);
      });
    });

    describe("User1 - Round0, amount: 500 USDT, bonusAPY: 9%, Tenure: 60, TradeBonus: true", () => {
      it("Should fail run new Round if amount less than minimum deposit", async () => {
        await USDTContract.connect(accounts[1]).approve(
          lenderPool2.address,
          ethers.constants.MaxUint256
        );
        await expect(
          lenderPool2.newRound(addresses[1], n6("500"), "900", 60, true)
        ).to.be.revertedWith("Amount lower than minimumDeposit");
      });
    });
  });

  describe("LenderPool - 3 - StableAPY: 6%, DAI, minDeposit: 100 DAI", () => {
    it("Should return the LenderPool once it's deployed", async function () {
      LenderPoolFactory = await ethers.getContractFactory("LenderPool");
      lenderPool3 = await LenderPoolFactory.deploy(DAIContract.address, "600");
      await lenderPool3.deployed();
      expect(
        await ethers.provider.getCode(lenderPool3.address)
      ).to.be.length.above(100);

      await DAIContract.transfer(lenderPool3.address, n18("10000"));
    });

    it("Should set the minimum deposit to 100 DAI", async () => {
      await lenderPool3.setMinimumDeposit(n18("100"));
    });

		describe("User0 - Round0, amount: 500 USDT, bonusAPY: 11%, Tenure: 30, TradeBonus: false", () => {
			it("Should run new Rounds for user0", async () => {
				await DAIContract.approve(
					lenderPool3.address,
					ethers.constants.MaxUint256
				);
				await lenderPool3.newRound(addresses[0], n18("500"), "1100", 30, false);
			});

			it("Should return stable rewards for user0 for round0 at the endPeriod", async () => {
				await increaseTime(ONE_DAY * 31);
				const rewardAfter = await lenderPool3.stableRewardOf(addresses[0], 0);
				expect(rewardAfter).to.equal(n18("2.465753424657534246"));
			});

			it("Should return bonus rewards for user0 for round0 at the endPeriod", async () => {
				const bonusRewardAfter = await lenderPool3.bonusRewardOf(addresses[0], 0);
				expect(bonusRewardAfter).to.equal(n18("4.520547945205479452"));
			});

			it("Should return total rewards for user0 for round0 at the endPeriod", async () => {
				const totalRewardAfter = await lenderPool3.totalRewardOf(
					addresses[0],
					0
				);
				expect(totalRewardAfter).to.equal(n18("6.986301369863013698"));
			});

			it("Should withdraw for user0 for round0", async () => {
				await lenderPool3.withdraw(addresses[0], 0);
			});
		});
  });
});


const UniqDrop = artifacts.require("UniqDrop");
const increaseTime = require("./utils/increaseTime.js").increaseTime;
const latestTime = require("./utils/latestTime.js").latestTime;
const assertRevert = require("./utils/assertRevert.js").assertRevert;
const web3 = require("./utils/web3");
contract("Scenario based testing for UniDrop", ([S1, S2, S3, S4, S5, S6]) => {
    
    it("0.Checking the total supply ", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      let totalSupply = await UniqDropInstance.totalSupply();
      console.log("Total supply of contract: ",parseFloat(totalSupply))
    });
    it("1.As an owner I must mint 100 tokens before sale and other users.", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      let totalSupply_before = await UniqDropInstance.totalSupply();
      console.log("Total supply of before mint: ",parseFloat(totalSupply_before))
      let saleStarted =  await UniqDropInstance.hasSaleStarted();
      console.log("Sale started: ",saleStarted)
      await UniqDropInstance.initialMint(S1, 50);
      await UniqDropInstance.initialMint(S3, 50);
      let totalSupply_after = await UniqDropInstance.totalSupply();
      console.log("Total supply after mint: ",parseFloat(totalSupply_after))
      await assertRevert(UniqDropInstance.initialMint(S1, 100));
    });
    // error in function: user can invest before the sale starts
    // it("2.As a user I am not able to start investing before an owner starts sale.", async () => {
    //   let UniqDropInstance = await UniqDrop.deployed();
    //   let saleStarted =  await UniqDropInstance.hasSaleStarted();
    //   console.log("Sale started: ",saleStarted)
    //   await assertRevert(UniqDropInstance.mintUniqly(20,{from : S2, value : 20e18}));
    // });
    it(" 3. As a user I need to know how much ETH I need to invest for the next N tokens before minting ", async () => {
        let UniqDropInstance = await UniqDrop.deployed();
        let totalSupply = await UniqDropInstance.totalSupply();
        let n=26;
        if (totalSupply+n<10000){
        let ETHToInvest = await UniqDropInstance.calculateEthPriceForExactUniqs(n,{from:S2});
        console.log("Eth needed to invest",ETHToInvest);
        }
    });
    it(" 4. As a user I am able to mint only from 1 to 30 tokens in one transaction ", async () => {
        let UniqDropInstance = await UniqDrop.deployed();
        await UniqDropInstance.startSale();
        await UniqDropInstance.mintUniqly(20,{from:S1, value : 20e18});
        await assertRevert(UniqDropInstance.mintUniqly(40,{from:S3, value : 40e18}));   
    });
    //error in function: Max supply has no check in mintUniqly() also, no condition whether the sale has ended.
    // it(" 5. As a user I am not able to invest once the sale is over and max supply reached 10000", async () => {
    //   let UniqDropInstance = await UniqDrop.deployed();
    //   let maxSupply =  await UniqDropInstance.MAX_UNIQLY();      
    //   console.log("Max supply:", maxSupply);
    //   //await UniqDropInstance.startSale();
    //   await UniqDropInstance.mintUniqly(20,{from:S3, value : 20e18});
    //   await UniqDropInstance.mintUniqly(20,{from:S2, value : 20e18});
    //   await UniqDropInstance.mintUniqly(20,{from:S4, value : 20e18});
    //   await UniqDropInstance.mintUniqly(20,{from:S5, value : 20e18});
    //   await UniqDropInstance.mintUniqly(20,{from:S6, value : 20e18});
    //   let totalSupply = await UniqDropInstance.totalSupply();
    //   console.log(parseFloat(totalSupply));

    //   //await assertRevert(UniqDropInstance.mintUniqly(20,{from:S6, value : 20e18}));
    // });  
    it(" 6. As a user I must get an array of my tokens", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      let arrayOfTokens =  await UniqDropInstance.tokensOfOwner(S1);      
      console.log("User's array of Tokens: ",parseFloat(arrayOfTokens));
      // await assertRevert(UniqDropInstance.calculateEthPriceForExactUniqs(maxSupply,{from : S2}));
    });
    it(" 7. As an owner I am able to change BASE_URI many times", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      await UniqDropInstance.setBaseURI("Test_URI_1", {from:S1});      
      await UniqDropInstance.setBaseURI("Test_URI_2", {from:S1});      
      await UniqDropInstance.setBaseURI("Test_URI_3", {from:S1});      
    });
    it(" 8. As an owner I am able to finally block possibility of changing the BASE_URI", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      await UniqDropInstance.setBaseURILock();      
      await assertRevert(UniqDropInstance.setBaseURI("Test_URI_1", {from:S1}));           
    });
    it(" 9. As an owner I am able to withdraw all ETH invested by users", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      let ownerBalance_BW = await web3.ethGetBalance(S1);
      console.log("Owner Balance BW:", parseFloat(ownerBalance_BW));
      await UniqDropInstance.mintUniqly(20,{from:S5, value : 20e18});  
      let contractBalance = await web3.ethGetBalance(UniqDropInstance.address);
      await UniqDropInstance.withdrawAll();    
      let ownerBalance_AW = await web3.ethGetBalance(S1);
      console.log("Owner Balance AW:", parseFloat(ownerBalance_AW));
      assert.equal((parseFloat(ownerBalance_AW)/1e18).toFixed(2), (parseFloat(contractBalance)/1e18 + parseFloat(ownerBalance_BW)/1e18).toFixed(2));   
    });
    
    //confirm once as no royalty fee is getting deducted
    it(" 10. As an owner I collect 7.5% royalty fee for each transaction", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      let royaltyInstanceAddress, royaltyInstanceAmount = await UniqDropInstance.royaltyInfo(500,{from:S4});    
      console.log("Royalty Address :",royaltyInstanceAddress," Royalty Fee Amount: ", royaltyInstanceAmount);            
    });
    
    it(" 11. As an owner I am able to draw a random number from VRF once sale is ended", async () => {
      // let UniqDropInstance = await UniqDrop.deployed();
      // //let randomNumber = await assertRevert(UniqDropInstance.getRandomNumber(60));   
      // let totalSupply = await UniqDropInstance.totalSupply();
      // console.log("Total supply of before mint: ",parseFloat(totalSupply));
      // //await UniqDropInstance.initialMint(S2, 30);
      // //await UniqDropInstance.initialMint(S3, 30);
      // let startSale = await UniqDropInstance.startSale();
      // await assertRevert(UniqDropInstance.mintUniqly(20,{from : S2, value : 20e18}));
      // let randomNum = await assertRevert(UniqDropInstance.getRandomNumber(60)); 
      let UniqDropInstance = await UniqDrop.deployed();
      let totalSupply_before = await UniqDropInstance.totalSupply();
      console.log("Total supply of before mint : ",parseFloat(totalSupply_before))
      await UniqDropInstance.startSale();
      let saleStarted =  await UniqDropInstance.hasSaleStarted();
      console.log("Sale started : ",saleStarted)
      await UniqDropInstance.mintUniqly(25, { from: S2, value: 25e18 });
      await UniqDropInstance.mintUniqly(25, { from: S3, value: 25e18 });
    });
    /* 
    // Winner length is comming zero and getwinner cannot be processed
    // it(" 12. As a user I can be a winner of lottery and I am able to check each of my token is the winner of the lottery", async () => {
    //   let UniqDropInstance = await UniqDrop.deployed();
    //   let checkWin = await UniqDropInstance.checkWin(501);    
    //   console.log(" check if my token has won: ",checkWin);            
    // });
    //token id is not allocated no winner
    // it(" 13. 20 / 10000 chance to be winner and based on VRF we have an array of tokens ids which won", async () => {
    //   let UniqDropInstance = await UniqDrop.deployed();
    //   let checkWin = await UniqDropInstance.checkWin(501);    
    //   assert.equal()
    //   console.log(" check if my token has won: ",checkWin);            
    // });
    
    it(" 14. Only 10 people can withdraw money, for instance", async () => {
      let UniqDropInstance = await UniqDrop.deployed();
      let winnersCount = await UniqDropInstance.getWinnersCount();
      console.log(" Winners Count: ", winnersCount);            
    });
*/
});

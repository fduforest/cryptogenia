var mock = require('mock-require')

mock('electron', {
      app: { getPath: function(){}},
      remote: { app: { getPath: function () { }}}
});

const arbitrageManager = require('../src/business/arbitrageManager')
const assert = require('chai').assert
const should = require('chai').should()
const expect = require('chai').expect

describe('Testing module arbitrageManager', () => {
      //* ***************************************************************************************/
      // Test getOptimumAmount
      //* ***************************************************************************************/
      describe('function: getOptimumAmount', function(){
            describe('When selling order are [[1, 1], [2, 1], [3, 2], [4, 1], [5, 3], [6, 2]] and buying orders [[5, 3], [4, 2], [3, 1], [2, 2], [1, 1], [0.5, 1]]', function(){
                  
                  let sellingOrderBook = [[1, 1], [2, 1], [3, 2], [4, 1], [5, 3], [6, 2]]
                  let buyingOrderBook = [[5, 3], [4, 2], [3, 1], [2, 2], [1, 1], [0.5, 1]]

                  let expectedAmount = 4
                  let expectedCost = 9
                  let expectedRevenue = 19

                  it(`should return optimum amount = ${expectedAmount}, cost = ${expectedCost} and revenue = ${expectedRevenue}.`, function () {
                        let result = arbitrageManager.getOptimumAmount(
                              buyingOrderBook,
                              sellingOrderBook
                        )

                        result.amount.should.be.equal(expectedAmount)
                        result.cost.should.be.equal(expectedCost)
                        result.revenue.should.be.equal(expectedRevenue)
                  })
            })
      })

      //* ***************************************************************************************/
      // Test getMinMaxForSymbol
      //* ***************************************************************************************/
      describe('function: getMinMaxForSymbol', function () {
            let allExchangeTickers = {
                  okex: { 'ETH/BTC': { ask: 10, bid: 8}, 'STR/BTC': { ask: 18, bid: 17}, 'KRA/BTC': {ask: 50, bid: 49}, 'ARK/BTC': {ask: 33, bid: 27} },
                  binance: { 'ETH/BTC': { ask: 11, bid: 9 }, 'STR/BTC': { ask: 17, bid: 16 }, 'ABC/BTC': { ask: 45, bid: 43 }, 'ARK/BTC': { ask: 30, bid: 28 } },
                  kraken: { 'ETH/BTC': { ask: 9, bid: 5 }, 'GBX/BTC': { ask: 12, bid: 10 }, 'ABC/BTC': { ask: 40, bid: 35 }, 'ARK/BTC': { ask: 35, bid: 27 } },
                  hitbtc: { 'ETH/BTC': { ask: 8, bid: 7 }, 'STR/BTC': { ask: 20, bid: 15 }, 'ABC/BTC': { ask: 42, bid: 40 }, 'ARK/BTC': { ask: 32, bid: 29 } }
            }

            let testcases = [
                  //symbol  minPriceExchange  maxPriceExchange  minPriceToBuy  maxPriceToSell
                  ['ETH/BTC', 'hitbtc', 'binance', 8, 9], 
                  ['STR/BTC', 'binance', 'okex', 17, 17],
                  ['ABC/BTC', 'kraken', 'binance', 40, 43],
                  ['ARK/BTC', 'binance', 'hitbtc', 30, 29],
                  ['KRA/BTC', 'okex', 'okex', 50, 49],
                  ['FOO/BTC', undefined, undefined, undefined, undefined],
            ]

            for(let i = 0; i < testcases.length; i++){
                  let symbol = testcases[i][0]
                  let expectedMinPriceExchange = testcases[i][1]
                  let expectedMaxPriceExchange = testcases[i][2]
                  let expectedMinPriceToBuy = testcases[i][3]
                  let expectedMaxPriceToSell = testcases[i][4]

                  it(`should return minPriceExchange = ${expectedMinPriceExchange}, maxPriceExchange = ${expectedMaxPriceExchange}, ` +
                        `minPriceToBuy = ${expectedMinPriceToBuy} and maxPriceToSell = ${expectedMaxPriceToSell} for ${symbol}`, function () {
                        let result = arbitrageManager.getMinMaxForSymbol(symbol, allExchangeTickers)
                        
                        if(result.minPriceToBuy === undefined) {
                              // Assert
                              should.not.exist(result.maxPriceExchange)
                              should.not.exist(result.minPriceExchange)
                              should.not.exist(result.maxPriceToSell)
                              return
                        }

                        // Assert
                        result.minPriceExchange.should.be.equal(expectedMinPriceExchange)
                        result.maxPriceExchange.should.be.equal(expectedMaxPriceExchange)
                        result.minPriceToBuy.should.be.equal(expectedMinPriceToBuy)
                        result.maxPriceToSell.should.be.equal(expectedMaxPriceToSell)
                  })
            }
            
      })
});
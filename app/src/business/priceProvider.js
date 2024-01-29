let ccxt = require('ccxt')
let logger = require('../scripts/components/logger')

exports.getPrice = async function (pair) {
  let btcmarkets = new ccxt.btcmarkets()
  try {
    let ticker = await btcmarkets.fetchTicker(pair)
    return ticker.info.lastPrice
  } catch (e) {
    logger.error(`Not able to fetch ${pair} price from BTC Markets.`)
  }
}

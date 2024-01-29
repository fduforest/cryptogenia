const ccxt = require('ccxt')
const Store = require('../store')
const logger = require('../scripts/components/logger')
const exchangeFileName = 'exchanges'
const marketsFileName = 'markets'
const exchangeSettingsFileName = 'exchangeSettings'

const store = new Store()

const logError = function (e) {
  if (e instanceof ccxt.DDoSProtection || e.message.includes('ECONNRESET')) {
    logger.error('[DDoS Protection Error] ' + e.message)
  } else if (e instanceof ccxt.RequestTimeout) {
    logger.error('[Timeout Error] ' + e.message)
  } else if (e instanceof ccxt.AuthenticationError) {
    logger.error('[Authentication Error] ' + e.message)
  } else if (e instanceof ccxt.ExchangeNotAvailable) {
    logger.error('[Exchange Not Available Error] ' + e.message)
  } else if (e instanceof ccxt.ExchangeError) {
    logger.error('[Exchange Error] ' + e.message)
  } else {
    throw e // rethrow all other exceptions
  }
}

const NoFetchTickersErrorMessage = function (exchangeName) {
  return `Skip ${exchangeName} as it does not have 'FetchTickers' capability.`
}

const isExchangeLoaded = function (exchange) {
  return exchange.markets !== undefined && Object.keys(exchange.markets).length > 0
}

exports.exchangeFileName = exchangeFileName
exports.marketsFileName = marketsFileName
exports.exchangeSettingsFileName = exchangeSettingsFileName

// ****************************************************************************************/
// Add an exchange to the current list
// ****************************************************************************************/
exports.AddExchangeToWorkArea = function (exchangeObj) {
  let exchange = new ccxt[exchangeObj.id]({ enableRateLimit: true })

  let settings = this.GetExchangeSettings(exchangeObj.id)
  Object.assign(exchange, settings)

  var currentExchanges = store.getFile(this.exchangeFileName)
  currentExchanges[exchange.id] = exchange

  store.saveFile(this.exchangeFileName, currentExchanges)

  return currentExchanges
}

// ****************************************************************************************/
// Get current exchanges
// ****************************************************************************************/
exports.GetCurrentExchanges = function () {
  let currentExchanges = store.getFile(exchangeFileName)
  let exchangeSettings = store.getFile(exchangeSettingsFileName)

  for (let id in currentExchanges) {
    let settings = exchangeSettings[id]
    if (settings) {
      currentExchanges[id] = Object.assign(currentExchanges[id], settings)
    }
  }

  return currentExchanges
}

// ****************************************************************************************/
// Get settings for a particular exchange
// ****************************************************************************************/
exports.GetExchangeSettings = function (id) {
  let exchangeSettings = store.getFile(exchangeSettingsFileName)
  return exchangeSettings[id]
}

// ****************************************************************************************/
// Save settings for a particular exchange
// ****************************************************************************************/
exports.SaveExchangeSettings = function (id, settingsObj) {
  let exchangeSettings = store.getFile(exchangeSettingsFileName)
  exchangeSettings[id] = settingsObj
  store.saveFile(this.exchangeSettingsFileName, exchangeSettings)
}

// ****************************************************************************************/
// Get current markets
// ****************************************************************************************/
exports.GetCurrentMarkets = function () {
  let markets = store.getFile(marketsFileName)
  return markets
}

// ****************************************************************************************/
// Returns an array of pairs with exchange id and name
// ****************************************************************************************/
exports.GetAllExchanges = function () {
  let exchanges = {}

  ccxt.exchanges.forEach(id => {
    exchanges[id] = new (ccxt)[id]().name
  })

  return exchanges
}

// ****************************************************************************************/
// Remove exchange from current list
// ****************************************************************************************/
exports.RemoveExchange = function (id) {
  let currentExchanges = store.getFile(exchangeFileName)

  delete currentExchanges[id]

  store.saveFile(this.exchangeFileName, currentExchanges)

  return currentExchanges
}

// ****************************************************************************************/
// Remove market from current list
// ****************************************************************************************/
exports.RemoveMarket = function (market) {
  let currentMarkets = store.getFile(marketsFileName)

  delete currentMarkets[market]

  store.saveFile(this.marketsFileName, currentMarkets)

  return currentMarkets
}

// ****************************************************************************************/
// Load Markets for current exchanges
// ****************************************************************************************/
exports.LoadMarkets = async function (currentExchanges) {
  let proxies = [
    '', // no proxy by default
    'https://crossorigin.me/',
    'https://cors-anywhere.herokuapp.com/'
  ]

  await Promise.all(Object.values(currentExchanges).map(async (currExchange) => {
    // Skip exchanges that are already loaded
    if (isExchangeLoaded(currExchange)) {
      return
    }

    // Skip exchanges that dont have fetchTickers
    if (!currExchange.hasFetchTickers) {
      logger.warn(NoFetchTickersErrorMessage(currExchange.name))
      return
    }

    let exchange = new ccxt[currExchange.id]({ enableRateLimit: true })
    exchange = Object.assign(exchange, currExchange)

    try {
      await exchange.loadMarkets()
    } catch (e) {
      logError(e)
    }

    // basic round-robin proxy scheduler
    let currentProxy = 0
    let maxRetries = proxies.length

    for (let numRetries = 0; numRetries < maxRetries; numRetries++) {
      try {
        // try to load exchange markets using current proxy
        exchange.proxy = proxies[currentProxy]
        await exchange.loadMarkets()
      } catch (e) {
        // rotate proxies in case of connectivity errors, catch all other exceptions
        logError(e)
        if (numRetries === maxRetries - 1) return
        // retry next proxy in round-robin fashion in case of error
        currentProxy = ++currentProxy % proxies.length
      }
    }

    logger.info(`${exchange.name}: loaded ${exchange.symbols.length} markets`)
    currentExchanges[exchange.id] = exchange
  }))
}

//* ***************************************************************************************/
// Get Common Symbols (It returns an object with the ids of the exchanges and all the workable symbols)
//* ***************************************************************************************/
let getCommonSymbols = function (exchanges) {
  let ids = []

  for (let id in exchanges) {
    ids.push(id)
  }
  // Remove exchanges that dont have fetchTickers
  ids = ids.filter(i => exchanges[i].hasFetchTickers)

  // get all unique symbols
  logger.trace('get unique symbols quoted in BTC or ETH.')
  let uniqueSymbols = ccxt.unique(ccxt.flatten(ids.map(id =>
    exchanges[id].symbols
      .filter(s => s.endsWith('BTC') || s.endsWith('ETH')))))

  // filter out symbols that are not present on at least two exchanges
  let arbitrableSymbols = uniqueSymbols
    .filter(symbol =>
      ids.filter(id =>
        (exchanges[id].symbols.indexOf(symbol) >= 0)).length > 1)
    .sort((id1, id2) => (id1 > id2) ? 1 : ((id2 > id1) ? -1 : 0))

  return {
    ids: ids,
    symbols: arbitrableSymbols
  }
}

exports.getCommonSymbols = getCommonSymbols

//* ***************************************************************************************/
// Fecth Data
//* ***************************************************************************************/
exports.fetchData = async function (exchanges, markets, eventTriggeringObj = undefined) {
  let symbols = Object.keys(markets)
  let ids = Object.keys(exchanges)

  let triggerFecthDataEvent = function () {
    if (eventTriggeringObj) {
      eventTriggeringObj.trigger('fetch-data')
    }
  }

  // load exchanges that haven't been loaded
  this.LoadMarkets(exchanges)

  let allExchangeTickers = {}
  logger.trace(`fetching tickers...`)

  await Promise.all(ids.map(async (id) => {
    if (exchanges[id].hasFetchTickers) {
      try {
        const exTickers = await exchanges[id].fetchTickers()
        allExchangeTickers[id] = exTickers
        logger.trace(`${exchanges[id].name}.`)
      } catch (e) {
        logger.error(`Unable to fetch tickers for ${exchanges[id].name}. ${e.message}`)
      }

      triggerFecthDataEvent()
    } else {
      triggerFecthDataEvent()
    }
  }))

  logger.trace(`finished tickers.`)

  let table = []

  if (allExchangeTickers.length < 2) {
    logger.warn('Not enough tickers, please try again later.')
    return
  }

  logger.trace(`Calculate spreads...`)

  for (let i = 0; i < symbols.length; i++) {
    let symbol = symbols[i]
    const minPriceSpread = window.settings.minimumSpread // %
    const minProfit = window.settings.minimumProfit

    let result = this.getMinMaxForSymbol(symbol, allExchangeTickers)

    let minPriceToBuy = result.minPriceToBuy
    let minPriceExchange = result.minPriceExchange
    let maxPriceToSell = result.maxPriceToSell
    let maxPriceExchange = result.maxPriceExchange
    let spread = ((maxPriceToSell - minPriceToBuy) / minPriceToBuy) * 100

    let excludeSymbol = minPriceToBuy === undefined ||
      minPriceExchange === maxPriceExchange ||
      minPriceToBuy > maxPriceToSell ||
      spread < minPriceSpread

    if (excludeSymbol) {
      if (eventTriggeringObj) {
        eventTriggeringObj.trigger('fetch-data')
      }
      logger.trace(`No spread for ${symbol}.`)
      continue
    }

    let row = { symbol }
    row['WhereToBuy'] = minPriceExchange
    row['BuyingPrice'] = minPriceToBuy
    row['WhereToSell'] = maxPriceExchange
    row['SellingPrice'] = maxPriceToSell
    row['Spread'] = `${Number(spread).toFixed(2)}%`

    let currencies = symbol.split('/')
    let base = currencies[0]
    let quote = currencies[1]
    let orders = []

    try {
      orders = await Promise.all([exchanges[maxPriceExchange].fetchL2OrderBook(symbol), exchanges[minPriceExchange].fetchL2OrderBook(symbol)])
    } catch (e) {
      logError(e)
      continue
    }

    let buyingOrders = orders[0].bids
    let sellingOrders = orders[1].asks

    let parameters = {
      buyingOrders,
      sellingOrders,
      buyFromTransactionFee: exchanges[minPriceExchange].transactionFee,
      sellToTransactionFee: exchanges[maxPriceExchange].transactionFee,
      baseWithdrawFee: exchanges[minPriceExchange].withdrawFees === undefined ? 0 : exchanges[minPriceExchange].withdrawFees[base] || 0,
      quoteWithdrawFee: exchanges[maxPriceExchange].withdrawFees === undefined ? 0 : exchanges[maxPriceExchange].withdrawFees[quote] || 0
    }

    let transactioResult = this.CalculateTransaction(parameters)

    let profit = transactioResult.profit

    if (profit < minProfit) continue

    row['Profit'] = Number(profit).toFixed(8)

    table.push(row)
  }

  table = table.filter(s => s.Spread !== null)

  logger.info('Finished!!')
  return table
}

//* ***************************************************************************************/
// Given all the tickers, Gets the minimum and maximum price for a particular symbol
//* ***************************************************************************************/
exports.getMinMaxForSymbol = function (symbol, allExchangeTickers) {
  let ids = Object.keys(allExchangeTickers)

  let minPriceToBuy
  let minPriceExchange
  let maxPriceToSell
  let maxPriceExchange

  for (let id of ids) {
    if (allExchangeTickers[id][symbol] === undefined) continue

    if (minPriceToBuy === undefined) {
      minPriceToBuy = allExchangeTickers[id][symbol]['ask']
      minPriceExchange = id
    }
    if (maxPriceExchange === undefined) {
      maxPriceToSell = allExchangeTickers[id][symbol]['bid']
      maxPriceExchange = id
    }

    if (allExchangeTickers[id][symbol]['ask'] < minPriceToBuy) {
      minPriceToBuy = allExchangeTickers[id][symbol]['ask']
      minPriceExchange = id
    }

    if (allExchangeTickers[id][symbol]['bid'] > maxPriceToSell) {
      maxPriceToSell = allExchangeTickers[id][symbol]['bid']
      maxPriceExchange = id
    }
  }

  return {
    minPriceToBuy,
    minPriceExchange,
    maxPriceToSell,
    maxPriceExchange
  }
}

//* ***************************************************************************************/
// Add a market to the current list
//* ***************************************************************************************/
exports.AddMarket = function (market) {
  var currentMarkets = store.getFile(this.marketsFileName)
  currentMarkets[market] = true

  store.saveFile(this.marketsFileName, currentMarkets)

  return currentMarkets
}

//* ***************************************************************************************/
// Delete all markets
//* ***************************************************************************************/
exports.DeleteMarkets = function () {
  store.saveFile(this.marketsFileName, {})
}

// ****************************************************************************************/
// Fetch balance for to be used in a transaction
// ****************************************************************************************/
exports.fetchBalance = async function (exchange, base, quote) {
  let balance

  try {
    balance = await exchange.fetchBalance()
  } catch (e) {
    let err = `Not possible to fetch balance from ${exchange.name}. ${e.message}`
    logger.error(err)
    return
  }

  let balanceBase = balance[base].total
  let balanceQuote = balance[quote].total

  let obj = {}

  obj[base] = balanceBase
  obj[quote] = balanceQuote

  return obj
}

//* ***************************************************************************************/
// Returns optimum amount to do the transaction as well as the cost and revenue
//* ***************************************************************************************/
exports.getOptimumAmount = function (buyingOrders, sellingOrders) {
  let bindex = 0
  let sindex = 0
  let accumAmount = 0
  let accumB = 0
  let accumS = 0
  let sellingAccumValue = 0
  let buyingAccumValue = 0

  while (bindex < buyingOrders.length && sindex < sellingOrders.length) {

    // if selling price is greater than buying price
    if (sellingOrders[sindex][0] >= buyingOrders[bindex][0]) {
      break
    }

    let buyingOrderAmount = buyingOrders[bindex][1]
    let sellingOrderAmount = sellingOrders[sindex][1]

    if (buyingOrderAmount + accumB < sellingOrderAmount + accumS) {
      accumB = accumB + buyingOrderAmount
      buyingAccumValue = buyingAccumValue + buyingOrders[bindex][0] * buyingOrderAmount
      accumAmount = accumB
      bindex = bindex + 1
    } else {
      accumS = accumS + sellingOrderAmount
      sellingAccumValue = sellingAccumValue + sellingOrders[sindex][0] * sellingOrderAmount
      accumAmount = accumS
      sindex = sindex + 1
    }
  }

  if (sellingOrders[sindex] === undefined || buyingOrders[bindex] === undefined) {
    logger.error('Number of order was not sufficient to calculate the optimum amount.')

    return { amount: accumAmount, cost: sellingAccumValue, revenue: buyingAccumValue }
  }

  let amount = accumAmount

  let sellingX = amount - accumS
  let buyingX = amount - accumB
  let cost = sellingAccumValue + (sellingOrders[sindex][0] * sellingX)
  let revenue = buyingAccumValue + (buyingOrders[bindex][0] * buyingX)

  return { amount, cost, revenue }
}

//* ***************************************************************************************/
// Calculate transaction profit, transactions fees, and withdraw fees
//* ***************************************************************************************/
exports.CalculateTransaction = function (parameters) {
  let { buyingOrders, sellingOrders, buyFromTransactionFee, sellToTransactionFee, baseWithdrawFee, quoteWithdrawFee } = parameters

  let result = this.getOptimumAmount(buyingOrders, sellingOrders)

  sellToTransactionFee = (sellToTransactionFee * result.revenue / 100) || 0
  buyFromTransactionFee = (buyFromTransactionFee * result.cost / 100) || 0
  let transactionFees = sellToTransactionFee + buyFromTransactionFee

  let withdrawFees = quoteWithdrawFee + baseWithdrawFee * buyingOrders[0][0]
  let amount = result.amount
  let profit = result.revenue - result.cost - transactionFees - withdrawFees

  return { amount, profit, transactionFees, withdrawFees }
}

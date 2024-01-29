'use strict'

const $ = require('jquery')
const pageLoader = require('./pageLoader')
const priceProvider = require('../business/priceProvider')
const logger = require('./components/logger')
const arbitrageManager = require('../business/arbitrageManager')
require('datatables.net')()

// ****************************************************************************************/
// Fetch balance for SellTo Exchange
// ****************************************************************************************/
let fecthBalanceSellToExchange = async function (transaction) {
  let exchange = window.CurrentExchanges[transaction.sellTo]

  logger.trace(`Fetching balance from ${transaction.sellTo}...`)
  let balance = await arbitrageManager.fetchBalance(exchange, transaction.base, transaction.quote)
  logger.info(`Balance from ${transaction.sellTo} ready.`)

  return balance
}

//* ***************************************************************************************/
// Fetch balance for BuyFrom Exchange
//* ***************************************************************************************/
let fecthBalanceBuyFromExchange = async function (transaction, quotePriceInAud) {
  let exchange = window.CurrentExchanges[transaction.buyFrom]

  logger.trace(`Fetching balance from ${transaction.buyFrom}...`)
  let balance = await arbitrageManager.fetchBalance(exchange, transaction.base, transaction.quote)
  logger.info(`Balance from ${transaction.buyFrom} ready.`)

  return balance
}

//* ***************************************************************************************/
// Print SellTo Balance
//* ***************************************************************************************/
const printSellToBalance = async function (transaction, balanceObj, quotePriceInAud) {
  let price = await quotePriceInAud
  let balance = await balanceObj

  if (balance === undefined) return

  let balanceQuoteInAUD = balance[transaction.quote] * price
  $('#sellToBalanceQuote').text(`${balance[transaction.quote]} ${transaction.quote}`)
  $('#sellToBalanceQuoteAUD').text(`A$${balanceQuoteInAUD.toFixed(2)}`)

  let balanceBaseInAUD = balance[transaction.base] * transaction.sellingPrice * price
  $('#sellToBalanceBase').text(`${balance[transaction.base]} ${transaction.base}`)
  $('#sellToBalancBaseAUD').text(`A$${balanceBaseInAUD.toFixed(2)}`)
}

//* ***************************************************************************************/
// Print BuyFrom Balance
//* ***************************************************************************************/
let printBuyFromBalance = async function (transaction, balanceObj, quotePriceInAud) {
  let price = await quotePriceInAud
  let balance = await balanceObj

  if (balance === undefined) return

  let balanceQuoteInAUD = balance[transaction.quote] * price
  $('#buyFromBalanceQuote').text(`${balance[transaction.quote]} ${transaction.quote}`)
  $('#buyFromBalanceQuoteAUD').text(`A$${balanceQuoteInAUD.toFixed(2)}`)

  let balanceBaseInAUD = balance[transaction.base] * transaction.buyingPrice * price
  $('#buyFromBalanceBase').text(`${balance[transaction.base]} ${transaction.base}`)
  $('#buyFromBalanceBaseAUD').text(`A$${balanceBaseInAUD.toFixed(2)}`)
}

//* ***************************************************************************************/
// On page load
//* ***************************************************************************************/
$(document).on('transaction-loaded', async function () {
  let transaction = window.CurrentTransaction
  let sellToExchange = window.CurrentExchanges[transaction.sellTo]
  let buyFromExchange = window.CurrentExchanges[transaction.buyFrom]
  let symbol = `${transaction.base}/${transaction.quote}`
  $('.sellToExchange').text(sellToExchange.name)
  $('.buyFromExchange').text(buyFromExchange.name)
  $('span[name=base]').text(transaction.base)
  $('span[name=quote]').text(transaction.quote)
  $('#pair').text(symbol)

  let priceInAUD = priceProvider.getPrice(`${transaction.quote}/AUD`)

  let buyFromBalancePromise = fecthBalanceBuyFromExchange(transaction)
  let sellToBalancePromise = fecthBalanceSellToExchange(transaction)

  await Promise.all([printBuyFromBalance(transaction, buyFromBalancePromise, priceInAUD),
    printSellToBalance(transaction, sellToBalancePromise, priceInAUD)])

  // Verify if transaction fees have been entered ********************************************
  if (sellToExchange.transactionFee === 0 || sellToExchange.transactionFee === '' || sellToExchange.transactionFee === undefined) {
    logger.error(`Transaction fee for ${sellToExchange.name} is unknown.`)
    sellToExchange.transactionFee = 0
  }

  if (buyFromExchange.transactionFee === 0 || buyFromExchange.transactionFee === '' || buyFromExchange.transactionFee === undefined) {
    logger.error(`Transaction fee for ${buyFromExchange.name} is unknown.`)
    buyFromExchange.transactionFee = 0
  }

  // Verify if withdraw fee for the quote currency has been informed **************************
  let quoteWithdrawFee = 0
  if (sellToExchange.withdrawFees === undefined || sellToExchange.withdrawFees[transaction.quote] === undefined) {
    logger.error(`Withdraw fee for ${transaction.quote} in ${sellToExchange.name} is unknown.`)
  } else {
    quoteWithdrawFee = sellToExchange.withdrawFees[transaction.quote]
  }

  // Verify if withdraw fee for the base currency has been informed **************************
  if (buyFromExchange.withdrawFees === undefined || buyFromExchange.withdrawFees[transaction.base] === undefined) {
    logger.error(`Withdraw fee for ${transaction.base} in ${buyFromExchange.name} is unknown.`)
  }

  // fund amount is used to calculate the optimum amount to trade based on the orderbooks
  let fundAmount = 0
  let buyFromBalance = await buyFromBalancePromise
  let sellToBalance = await sellToBalancePromise

  if (buyFromBalance !== undefined && sellToBalance !== undefined) {
    fundAmount = Math.min(buyFromBalance[transaction.base], sellToBalance[transaction.base])
  }

  pageLoader.loop(async function () {
    let amount = fundAmount
    let orders = await Promise.all([sellToExchange.fetchL2OrderBook(symbol), buyFromExchange.fetchL2OrderBook(symbol)])
    let buyingOrders = orders[0].bids
    let sellingOrders = orders[1].asks

    let priceSpread = ((buyingOrders[0][0] - sellingOrders[0][0]) / sellingOrders[0][0]) * 100
    $('#price-spread').text(`${priceSpread.toFixed(2)}%`)

    drawTable($('#sellToOrderBookTable'), buyingOrders)
    drawTable($('#buyFromOrderBookTable'), sellingOrders)

    if (amount === 0) {
      amount = 0.1 / buyingOrders[0][0]
      fundAmount = amount
      logger.warn(`No funds to trade. In order to analyse data, it is assumed that initial reserve amount is 0.1${transaction.quote} 
      (${amount} ${transaction.base}).`)
    }

    let parameters = {
      fundAmount: amount,
      buyingOrders,
      sellingOrders,
      buyFromTransactionFee: buyFromExchange.transactionFee,
      sellToTransactionFee: sellToExchange.transactionFee,
      baseWithdrawFee: buyFromExchange.withdrawFees === undefined ? 0 : buyFromExchange.withdrawFees[transaction.base] || 0,
      quoteWithdrawFee
    }

    let result = arbitrageManager.CalculateTransaction(parameters)

    $('#optimum-amount').text(`${result.amount.toFixed(8)} ${transaction.base}`)
    $('#transaction-fees').text(`-${result.transactionFees.toFixed(8)} ${transaction.quote}`)
    $('#withdraw-fees').text(`-${result.withdrawFees.toFixed(8)} ${transaction.quote}`)
    let profitLabel = $('#profit')
    profitLabel.text(`${result.profit.toFixed(8)} ${transaction.quote}`)

    if (result.profit >= 0) {
      profitLabel.addClass('green')
    } else {
      profitLabel.addClass('red')
    }

    let price = await priceInAUD
    let profitAud = result.profit * price
    $('#profitAud').text(`A$${profitAud.toFixed(2)}`)
  }, 1000)
})

//* ***************************************************************************************/
// Draw table
//* ***************************************************************************************/
let drawTable = function ($table, data) {
  let body = $table.find('tbody')
  body.html('')
  let tr = ''

  for (let i = 0; i < data.length; i++) {
    let price = data[i][0]
    let amount = data[i][1]
    let total = (data[i][0] * data[i][1]).toFixed(8)
    tr = `<tr><td>${price}</td><td>${amount}</td><td>${total}</td></tr>`
    body.append(tr)
  }
}

const load = function () {
  pageLoader.load('transaction')
}

exports.load = load

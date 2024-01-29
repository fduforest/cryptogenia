const $ = require('jquery')
const arbitrageManager = require('../business/arbitrageManager')
const layout = require('./layout')
const pageLoader = require('./pageLoader')
const logger = require('./components/logger')
const priceProvider = require('../business/priceProvider')
const btcAud = priceProvider.getPrice('BTC/AUD')

// ****************************************************************************************/
// On Load Page
// ****************************************************************************************/
$(document).on('exchange-loaded', async function (e, data) {
  let createNewLine = function (coin, fee) {
    let newLine = '<tr>'
    newLine = newLine + `<td><input type="text" class="table-input" value="${coin}"></td>`
    newLine = newLine + `<td><input type="text" class="table-input" value="${fee}"></td>`
    newLine = newLine + '</tr>'

    return newLine
  }

  let apiKey = $('#apiKey')
  let secret = $('#secret')
  let transactionFee = $('#transactionFee')
  let withdrawFeesTable = $('#withdraw-fees-table tbody')

  let exchange = window.CurrentExchanges[data.id]
  let exchangeSettings = arbitrageManager.GetExchangeSettings(exchange.id) || {}

  // ****************************************************************************************/
  // On Add new line to withdraw fees table
  // ****************************************************************************************/
  $('#bt-withdraw-fee').on('click', function () {
    let newLine = createNewLine('', '')

    withdrawFeesTable.append(newLine)
  })

  // ****************************************************************************************/
  // Save exchange settings
  // ****************************************************************************************/
  $('#save-exchange-button').on('click', function () {
    if (window.CurrentExchanges[exchange.id] !== undefined) {
      exchangeSettings.apiKey = apiKey.val()
      exchangeSettings.secret = secret.val()
      exchangeSettings.transactionFee = parseFloat(transactionFee.val())

      if (isNaN(exchangeSettings.transactionFee)) exchangeSettings.transactionFee = ''

      let withdrawFees = {}
      withdrawFeesTable.find('tr').each(function () {
        let row = $(this)
        let cells = row.find('td input')

        let coin = $(cells[0]).val()
        let fee = parseFloat($(cells[1]).val())

        if (isNaN(fee)) fee = ''

        if (coin !== '' && fee !== '') {
          withdrawFees[coin] = fee
        }
      })

      exchangeSettings.withdrawFees = withdrawFees

      // Update current exchange in memory
      window.CurrentExchanges[exchange.id].apiKey = apiKey.val()
      window.CurrentExchanges[exchange.id].secret = secret.val()
      window.CurrentExchanges[exchange.id].transactionFee = transactionFee.val()
      window.CurrentExchanges[exchange.id].withdrawFees = withdrawFees

      // Persist information
      arbitrageManager.SaveExchangeSettings(exchange.id, exchangeSettings)

      pageLoader.load('dashboard')
      return
    }

    layout.reloadExchanges()

    pageLoader.load('dashboard')
  })

  // ****************************************************************************************/
  // Add coin to Balance
  // ****************************************************************************************/
  let addBalance = function (coin, amount, amountAud) {
    let element = '<div class="mb-10">'
    element = element + '<label class="xsmall-label">' + coin
    element = element + '</label>'
    element = element + '<span>' + amount + '</span>  '
    element = element + '<small class="float-right"> A$' + amountAud.toFixed(2) + '</small>'
    element = element + '</div>'

    $('#exchange-balance .panel-body').append(element)
  }

  // Load textboxes
  $('#exchangeId').text(exchange.name)
  apiKey.val(exchangeSettings.apiKey || '')
  secret.val(exchangeSettings.secret || '')
  transactionFee.val(exchangeSettings.transactionFee || '')

  // Load withdraw fees
  if (exchangeSettings.withdrawFees) {
    if (Object.keys(exchangeSettings.withdrawFees).length > 0) {
      let ids = Object.keys(exchangeSettings.withdrawFees).sort((a, b) => {
        if (a >= b) return 1
        if (a < b) return -1
      })

      for (let i = 0; i < ids.length; i++) {
        withdrawFeesTable.append(createNewLine(ids[i], exchangeSettings.withdrawFees[ids[i]]))
      }
    }
  }

  // Load Balance
  logger.trace(`Fetching balance for ${exchange.name}...`)
  if (apiKey.val() === '' || secret.val() === '') {
    logger.warn('Unable to fetch balance. Enter API key and secret.')
    $('#balance-spinner').addClass('hidden')
  } else {
    let balances = {}
    try {
      balances = await exchange.fetchBalance()
    } catch (e) {
      let err = `Not possible to fetch balance from ${exchange.name}. ${e.message}`
      logger.error(err)
      $('#balance-spinner').addClass('hidden')
      return
    }

    let exTickers = {}
    try {
      exTickers = await exchange.fetchTickers()
    } catch (e) {
      $('#balance-spinner').addClass('hidden')
      logger.error(`Unable to fetch tickers for ${exchange.name}. ${e.message}`)
      return
    }

    for (let coin in balances) {
      let total = balances[coin].total
      let btcPrice = await btcAud

      if (total !== 0 && total !== undefined) {
        let amountAud = 0
        if (coin !== 'BTC') {
          let symbol = `${coin}/BTC`
          if (exTickers[symbol]) {
            amountAud = exTickers[symbol]['bid'] * total * btcPrice
          }
        } else { amountAud = total * btcPrice }

        addBalance(coin, balances[coin].total, amountAud)
      }
    }

    $('#balance-spinner').addClass('hidden')
    logger.trace(`Finished fetching balance.`)
  }
})

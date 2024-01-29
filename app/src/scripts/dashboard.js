const $ = require('jquery')
const pageLoader = require('./pageLoader')
const arbitrageManager = require('../business/arbitrageManager')
const layout = require('./layout')
const logger = require('./components/logger')
const progressBar = require('./components/progress-bar')
const os = require('os')
const fs = require('fs')
const path = require('path')

require('datatables.net')()

let alert = new Audio('assets/sounds/alert.mp3')
alert.loop = true

$(document).on('dashboard-loaded', async function () {
  // Initialise Table
  let data = window.CurrentData || []

  let columns = [
        {title: 'Market', data: 'symbol'},
        {title: 'Where to Buy', data: 'WhereToBuy'},
        {title: 'Buying Price', data: 'BuyingPrice'},
        {title: 'Where to Sell', data: 'WhereToSell'},
        {title: 'Selling Price', data: 'SellingPrice'},
        {title: 'Spread', data: 'Spread'},
        {title: 'Profit', data: 'Profit'}
  ]

  let table = $('#mainTable').DataTable({
    data: data,
    columns: columns,
    'lengthChange': false
  })

  let loadedExchanges = await arbitrageManager.LoadMarkets(window.CurrentExchanges)

  for (let id in loadedExchanges) {
    window.CurrentExchanges[id] = loadedExchanges[id]
  }

  layout.reloadExchanges()

  window.CurrentMarkets = window.CurrentMarkets || arbitrageManager.GetCurrentMarkets()

  $('#button-section').removeClass('hidden')

  function showStopButton () {
    $('.progress-bar').after('<button id="bt-stop" class="bt icon-button"><i class="fa fa-stop"></i></button>')
  }

  // On Run click
  $('#run-button').click(async function () {
    showStopButton()

    pageLoader.loop(async function () {
      layout.cleanLogger()
      progressBar.start()

      if (window.CurrentExchanges === undefined || Object.keys(window.CurrentExchanges).length === 0) {
        logger.error('No exchanges have been entered.')
        progressBar.stop()
        return
      }

      if (window.CurrentMarkets === undefined || Object.keys(window.CurrentMarkets).length === 0) {
        logger.error('No markets have been entered.')
        progressBar.stop()
        return
      }

      let numberOfItemsToCount = Object.keys(window.CurrentExchanges).length + Object.keys(window.CurrentMarkets).length
      let itemCount = 0

      $(document).on('fetch-data', function () {
        itemCount++
        let percentage = (itemCount / numberOfItemsToCount) * 100
        progressBar.setProgress(percentage)
      })

      data = await arbitrageManager.fetchData(window.CurrentExchanges, window.CurrentMarkets, $(document))

      table.clear()
      table.rows.add(data)
      table.draw()

      window.CurrentData = data

      progressBar.stop()

      if (data.length === 0) {
        alert.pause()
        return
      }

      alert.play()

      // if save in CSV
      if ($('#csv-check').is(':checked')) {
        let filePath = path.join(os.homedir(), 'Desktop', 'arbitrage-data.csv')
        let currentDate = new Date().toLocaleString('en-GB', { timeZone: 'Australia/Sydney' })
        for (let i = 0; i < data.length; i++) {
          let line = `"${currentDate}","${data[i].symbol}","${data[i].WhereToBuy}","${data[i].WhereToSell}","${data[i].Spread}","${data[i].Profit}"` + '\r\n'

          fs.appendFile(filePath, line, function (err) {
            if (err) return console.log(err)
            console.log('Appended!')
          })

          table.clear()
          table.rows.add(data)
          table.draw()
        }
      }
    }, 15000) // 15 seconds
  })

  // On Click table row ********************************
  $('#mainTable tbody').on('click', 'tr', function () {
    let transaction = table.row(this).data()
    let currencies = transaction['symbol'].split('/')

    window.CurrentTransaction = {
      buyFrom: transaction['WhereToBuy'],
      base: currencies[0],
      quote: currencies[1],
      sellTo: transaction['WhereToSell'],
      buyingPrice: transaction['BuyingPrice'],
      sellingPrice: transaction['SellingPrice']
    }

    pageLoader.load('transaction')
  })

  $(document).on('click', '#bt-stop', function () {
    window.isLooping = false
    alert.pause()
    $(this).remove()
  })
})

const load = function () {
  pageLoader.load('dashboard')
}

exports.load = load

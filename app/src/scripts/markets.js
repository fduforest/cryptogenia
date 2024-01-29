const $ = require('jquery')
const arbitrageManager = require('../business/arbitrageManager')
const layout = require('./layout')

$(document).on('markets-loaded', async function () {
  await arbitrageManager.LoadMarkets(window.CurrentExchanges)
  let exchanges = window.CurrentExchanges

  let commonSymbols = arbitrageManager.getCommonSymbols(window.CurrentExchanges)

  let symbols = commonSymbols.symbols

  let columns = [
        {title: 'Market', data: 'symbol'}
  ]

  let bgColor = function (td, cellData, rowData, row, col) {
    let isCommon = true

    for (let exch in rowData) {
      if (exch === 'symbol') continue

      isCommon = isCommon && rowData[exch]
    }

    $(td).text('')
    if (cellData) {
      $(td).addClass('bg-lightgreen')
    }

    if (isCommon) {
      $(td).addClass('bg-incommon')
    }
  }

  for (let i = 0; i < commonSymbols.ids.length; i++) {
    columns.push({title: commonSymbols.ids[i], data: commonSymbols.ids[i], createdCell: bgColor})
  }

  columns.push({title: 'count', data: 'count'})

  let data = symbols.map(symbol => {
    let row = {symbol}
    let count = 0

    for (let id of commonSymbols.ids) {
      if (exchanges[id].symbols.indexOf(symbol) >= 0) {
        row[id] = true
        count++
      } else {
        row[id] = false
      }
    }

    row.count = count
    return row
  })

  let table = $('#marketsTable').DataTable({
    data: data,
    columns: columns,
    'lengthChange': false
  })

    // On row click add symbol to current list
  $('#marketsTable tbody').on('click', 'tr', function () {
    var data = table.row(this).data()

    window.CurrentMarkets = arbitrageManager.AddMarket(data['symbol'])
    layout.reloadMarkets()
  })

    // Prepend 'Add all'
  $('#marketsTable_wrapper').prepend('<button id="add-all-button" class="bt table-button">All</button>')
  $('#add-all-button').on('click', function () {
    symbols.map(symbol => {
      window.CurrentMarkets = arbitrageManager.AddMarket(symbol)
    })
    layout.reloadMarkets()
  })

   // Prepend 'BTC markets'
  $('#marketsTable_wrapper').prepend('<button id="add-btc" class="bt table-button">BTC only</button>')
  $('#add-btc').on('click', function () {
    symbols.map(symbol => {
      if (symbol.split('/')[1] === 'BTC') {
        window.CurrentMarkets = arbitrageManager.AddMarket(symbol)
      }
    })
    layout.reloadMarkets()
  })
})

const $ = require('jquery')
const ccxt = require('ccxt')
const layout = require('./layout')
const arbitrageManager = require('../business/arbitrageManager')

$(document).on('exchangeTable-loaded', async function () {
  let capabilities =
    [
      'fetchTickers',
      'fetchOrderBook',
      'fetchBalance',
      'createOrder',
      'fetchOrder',
      'fetchOrders',
      'fetchOpenOrders',
      'fetchCurrencies',
      'fetchDepositAddress',
      'withdraw'
    ]

  let data = ccxt.exchanges.map(id => {
    let exchange = new ccxt[id]()
    let row = {exchange: exchange.name}
    let total = 0

    capabilities.forEach(key => {
      if (!exchange.has[key]) {
        row[key] = false
      } else {
        row[key] = true
        total++
      }
    })

    row['total'] = total
    row['id'] = exchange.id

    return row
  })

  let bgColor = function (td, cellData, rowData, row, col) {
    $(td).text('')
    if (cellData) {
      $(td).addClass('bg-lightgreen')
    }
  }

  let columns = [
        {title: 'Exchange', data: 'exchange'}
  ]

  for (let i = 0; i < capabilities.length; i++) {
    let title = capabilities[i].replace('fetch', 'f')
    title = title.replace('Order', 'Ord')
    title = title.replace('Order', 'Ord')
    columns.push({title: title, data: capabilities[i], createdCell: bgColor})
  }

  columns.push({title: 'Total', data: 'total'})
  columns.push({title: 'id', data: 'id', visible: false})

  let table = $('#exchangeTable').DataTable({
    data: data,
    columns: columns,
    'lengthChange': false
  })

    // On row click add symbol to current list
  $('#exchangeTable tbody').on('click', 'tr', function () {
    var data = table.row(this).data()

    if (window.CurrentExchanges[data.id]) return
    let exchange = new ccxt[data.id]({ enableRateLimit: true })

    let settings = arbitrageManager.GetExchangeSettings(data.id)
    Object.assign(exchange, settings)

    window.CurrentExchanges[data.id] = exchange
    arbitrageManager.AddExchangeToWorkArea(exchange)
    layout.reloadExchanges()
  })
})

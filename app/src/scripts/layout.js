const $ = require('jquery')
const arbitrageManager = require('../business/arbitrageManager')
const pageLoader = require('../scripts/pageLoader')
const {remote} = require('electron')
const {Menu, MenuItem} = remote
const Settings = require('../settings')
const settings = new Settings()

var rightClickedElement

//* ***************************************************************************************/
// Reload exchanges on the sidebar
//* ***************************************************************************************/
const reloadExchanges = function () {
  let currentExchanges = window.CurrentExchanges || {}

  let items = ''

  let exchanges = Object.values(currentExchanges).sort((a, b) => {
    if (a.name >= b.name) return 1
    if (a.name < b.name) return -1
  })

  for (let i = 0; i < exchanges.length; i++) {
    items = items + `<li data-id="${exchanges[i].id}"><label>${exchanges[i].name}</label></li>`
  }

  let exchangesSection = $('#sidebar-exchanges-section ul')
  exchangesSection.html(items)
}

//* ***************************************************************************************/
// Initialise settings
//* ***************************************************************************************/
const setSettings = function () {
  $('#settings #minimumSpread').val(settings.minimumSpread)
  $('#settings #minimumProfit').val(settings.minimumProfit)
  window.settings = settings
}

//* ***************************************************************************************/
// Reload markets on the sidebar
//* ***************************************************************************************/
const reloadMarkets = function () {
  let currentMarkets = window.CurrentMarkets || {}

  let markets = Object.keys(currentMarkets).sort((a, b) => {
    if (a >= b) return 1
    if (a < b) return -1
  })

  let items = ''

  for (let i = 0; i < markets.length; i++) {
    items = items + `<li><label>${markets[i]}</label></li>`
  }

  let section = $('#sidebar-markets-section ul')
  section.html(items)
}

//* ***************************************************************************************/
// Toggle Settings panel
//* ***************************************************************************************/
$('#bt-settings').on('click', function (e) {
  e.stopPropagation()
  $('#settings').addClass('visible')
})

$('#settings .close').on('click', function () {
  $('#settings').removeClass('visible')
})

$(document).on('click', function (e) {
  if ($(e.target).parents('.visible').length !== 0) return

  $('#settings').removeClass('visible')
})

//* ***************************************************************************************/
// Set Minimum spread when it changes
//* ***************************************************************************************/
$('#settings #minimumSpread').on('change', function () {
  settings.minimumSpread = $('#settings #minimumSpread').val()
  window.settings = settings
})

//* ***************************************************************************************/
// Set Minimum profit when it changes
//* ***************************************************************************************/
$('#settings #minimumProfit').on('change', function () {
  settings.minimumProfit = $('#settings #minimumProfit').val()
  window.settings = settings
})

//* ***************************************************************************************/
// Remove exchange context menu
//* ***************************************************************************************/
const appendContextMenuToExchanges = function () {
  const exchangeMenu = new Menu()

  exchangeMenu.append(new MenuItem({
    label: 'Remove',
    click (e) {
      let id = $(rightClickedElement).data('id')
      delete window.CurrentExchanges[id]
      arbitrageManager.RemoveExchange(id)
      reloadExchanges()
    }
  }))

  $(document).on('contextmenu', '#sidebar-exchanges-section li', function (e) {
    e.preventDefault()
    rightClickedElement = e.target
    exchangeMenu.popup(remote.getCurrentWindow())
  })
}

//* ***************************************************************************************/
// Remove market context menu
//* ***************************************************************************************/
const appendContextMenuToMarkets = function () {
  const marketMenu = new Menu()

  marketMenu.append(new MenuItem({
    label: 'Remove',
    click (e) {
      let market = $(rightClickedElement).find('label').text()
      delete window.CurrentMarkets[market]
      arbitrageManager.RemoveMarket(market)
      reloadMarkets()
    }
  }))

  $(document).on('contextmenu', '#sidebar-markets-section li', function (e) {
    e.preventDefault()
    rightClickedElement = e.target
    marketMenu.popup(remote.getCurrentWindow())
  })
}

//* ***************************************************************************************/
// Delete all markets
//* ***************************************************************************************/
$('#bt-delete-markets').on('click', function () {
  arbitrageManager.DeleteMarkets()
  window.CurrentMarkets = {}
  reloadMarkets()
})

//* ***************************************************************************************/
// Clean logger panel
//* ***************************************************************************************/
const cleanLogger = function () {
  $('#logging-panel').html('')
}

//* ***************************************************************************************/
// Initialise the layout
//* ***************************************************************************************/
const initialise = function () {
  $('.sidebar-header').on('click', function () {
    pageLoader.load('dashboard')
  })

  $('#bt-exchange-table').on('click', function () {
    pageLoader.load('exchangeTable')
  })

  $(document).on('click', '#sidebar-exchanges-section li', function () {
    let id = $(this).data('id')
    pageLoader.load('exchange', {id})
  })

  $('#bt-markets').on('click', function () {
    pageLoader.load('markets')
  })

  setSettings()
  reloadExchanges()
  reloadMarkets()
  appendContextMenuToExchanges()
  appendContextMenuToMarkets()
}

exports.initialise = initialise
exports.appendContextMenuToExchanges = appendContextMenuToExchanges
exports.appendContextMenuToMarkets = appendContextMenuToMarkets
exports.reloadExchanges = reloadExchanges
exports.reloadMarkets = reloadMarkets
exports.cleanLogger = cleanLogger

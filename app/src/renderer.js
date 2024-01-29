const dashboard = require('./scripts/dashboard')
const layout = require('./scripts/layout')
const arbitrageManager = require('./business/arbitrageManager')
const logger = require('./scripts/components/logger')

window.CurrentExchanges = arbitrageManager.GetCurrentExchanges()
window.CurrentMarkets = arbitrageManager.GetCurrentMarkets()
window.settings.minimumSpread = 5

window.onerror = function (errorMsg, url, lineNumber, column, errorObj) {
  logger.error(errorMsg)
}

dashboard.load()

layout.initialise()

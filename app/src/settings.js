const Store = require('./store')
const store = new Store()

const settingsFileName = 'settings'
let settings = store.getFile(settingsFileName)

const minimumSpread = 5
const minimumProfit = 0.001

class Settings {
  constructor () {
    if (Object.keys(settings).length === 0) {
      settings.minimumSpread = minimumSpread
      settings.minimumProfit = minimumProfit

      store.saveFile(settingsFileName, settings)
    }

    this.minimumSpread = settings.minimumSpread
    this.minimumProfit = settings.minimumProfit
  }

  // minimumSpread *****
  get minimumSpread () {
    return this._minimumSpread
  }

  set minimumSpread (value) {
    let floatValue = parseFloat(value)
    this._minimumSpread = floatValue
    settings.minimumSpread = floatValue
    store.saveFile(settingsFileName, settings)
  }

  // minimumProfit *****
  get minimumProfit () {
    return this._minimumProfit
  }

  set minimumProfit (value) {
    let floatValue = parseFloat(value)
    this._minimumProfit = floatValue
    settings.minimumProfit = floatValue
    store.saveFile(settingsFileName, settings)
  }
}

module.exports = Settings

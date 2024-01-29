const timers = require('timers')
const $ = require('jquery')
const layout = require('./layout')
const logger = require('./components/logger')
const spinner = require('./components/spinner')

const load = function (pageName, model = undefined) {
  window.isLooping = false

  let link = document.querySelector(`link[rel="import"][data-import="${pageName}"]`)
  let content = link.import
  let template = content.querySelector('template').cloneNode(true)

  let container = $('#content')
  container.html(template.innerHTML)
  layout.cleanLogger()
  spinner.stop()

  container.trigger(`${pageName}-loaded`, [model])
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const loop = async function (func, milisec) {
  let asyncFunc = async function () {
    await func()
    await wait(milisec)
  }

  window.isLooping = true

  await asyncFunc()

  while (window.isLooping) {
    try {
      await asyncFunc()
    } catch (e) {
      logger.error(`Execution interruped. ${e.message}.`)
    }
  }
}

module.exports.loop = loop
module.exports.load = load

load('dashboard')

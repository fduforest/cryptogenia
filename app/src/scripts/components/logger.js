const $ = require('jquery')

let Color = {
  Red: 'red',
  Green: 'green',
  Orange: 'orange',
  Black: 'black'
}

let log = function (text, color) {
  let panel = $('#logging-panel')
  text = `<p style="color: ${color}">${text}</p>`
  panel.html(panel.html() + text)
  panel.scrollTop(panel[0].scrollHeight)
}

let info = function (text) {
  log(text, Color.Green)
}

let warn = function (text) {
  log(text, Color.Orange)
}

let error = function (text) {
  log(text, Color.Red)
}

let trace = function (text) {
  log(text, Color.Black)
}

exports.info = info
exports.warn = warn
exports.error = error
exports.trace = trace

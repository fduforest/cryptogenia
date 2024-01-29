const $ = require('jquery')

const container = $('.progress-bar')

const setProgress = function (progress) {
  container.find('span').width(`${progress}%`)
}

const start = function () {
  container.removeClass('hidden')
  setProgress(0)
}

const stop = function () {
  container.addClass('hidden')
  setProgress(0)
}

exports.start = start
exports.stop = stop
exports.setProgress = setProgress

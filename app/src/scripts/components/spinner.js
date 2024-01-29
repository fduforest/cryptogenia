const $ = require('jquery')

const spinnerContainer = $('.spinner')

const start = function() {
      spinnerContainer.removeClass('hidden')
}

const stop = function () {
      spinnerContainer.addClass('hidden')
}

exports.start = start
exports.stop = stop
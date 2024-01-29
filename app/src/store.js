const electron = require('electron')
const path = require('path')
const fs = require('fs')

class Store {
  constructor (opts) {
    // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
    // app.getPath('userData') will return a string of the user's app data directory path.
    this.userDataPath = (electron.app || electron.remote.app).getPath('userData')
  }

  // Returns the content of file
  getFile (file) {
    let filePath = path.join(this.userDataPath, file + '.json')
    let data = parseDataFile(filePath)
    if (data === undefined) { return {} }

    return data
  }

  saveFile (file, val) {
    let filePath = path.join(this.userDataPath, file + '.json')
    let content = JSON.stringify(val)

    fs.writeFileSync(filePath, content, function (err) {
      if (err) throw err
      console.log(`Error when trying to write file ${filePath}`)
    })
  }
}

function parseDataFile (filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath))
    } catch (err) {
      console.log(err)
    }
  } else {
    return {}
  }
}

// expose the class
module.exports = Store

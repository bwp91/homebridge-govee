/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils')
const fs = require('fs')

class PluginUiServer extends HomebridgePluginUiServer {
  constructor () {
    super()
    this.onRequest('/getCachedAccessories', async () => {
      try {
        const devicesToReturn = []
        const accessoriesFile = this.homebridgeStoragePath + '/accessories/cachedAccessories'
        if (fs.existsSync(accessoriesFile)) {
          let cachedAccessories = await fs.promises.readFile(accessoriesFile)
          cachedAccessories = JSON.parse(cachedAccessories)
          cachedAccessories.filter(accessory => accessory.plugin === 'homebridge-govee')
            .forEach(accessory => {
              devicesToReturn.push({
                displayName: accessory.displayName,
                context: accessory.context
              })
            })
        }
        return devicesToReturn
      } catch (err) {
        return []
      }
    })
    this.ready()
  }
}

(() => {
  return new PluginUiServer()
})()

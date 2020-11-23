const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils')
const fs = require('fs')

class PluginUiServer extends HomebridgePluginUiServer {
  constructor () {
    super()
    this.onRequest('/getCachedAccessories', async () => {
      try {
        const devicesToReturn = []
        let cachedAccessories = await fs.promises.readFile(this.homebridgeStoragePath + '/accessories/cachedAccessories')
        cachedAccessories = JSON.parse(cachedAccessories)
        cachedAccessories
          .filter(accessory => accessory.plugin === 'homebridge-govee')
          .sort((a, b) => {
            return a.displayName.toLowerCase() > b.displayName.toLowerCase()
              ? 1
              : b.displayName.toLowerCase() > a.displayName.toLowerCase()
                ? -1
                : 0
          })
          .forEach(accessory => {
            devicesToReturn.push({
              displayName: accessory.displayName,
              context: accessory.context
            })
          })
        return devicesToReturn
      } catch {
        return []
      }
    })
    this.ready()
  }
}

(() => {
  return new PluginUiServer()
})()

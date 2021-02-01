/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils')
const fs = require('fs')

class PluginUiServer extends HomebridgePluginUiServer {
  constructor () {
    super()
    this.onRequest('/getCachedAccessories', async () => {
      try {
        const devicesToReturn = []
        const accFile = this.homebridgeStoragePath + '/accessories/cachedAccessories'
        if (fs.existsSync(accFile)) {
          let cachedAccessories = await fs.promises.readFile(accFile)
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

(() => new PluginUiServer())()

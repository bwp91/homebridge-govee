import { createRequire } from 'node:module'

import goveePlatform from './platform.js'

const require = createRequire(import.meta.url)
const plugin = require('../package.json')

export default hb => hb.registerPlatform(plugin.alias, goveePlatform)

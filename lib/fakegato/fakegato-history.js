/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const Format = require('util').format
const FakeGatoTimer = require('./fakegato-timer')
const FakeGatoStorage = require('./fakegato-storage')
const _EPOCH = 978307200
const TYPE_ENERGY = 'energy'
const TYPE_ROOM = 'room'
const TYPE_WEATHER = 'weather'
const TYPE_DOOR = 'door'
const TYPE_MOTION = 'motion'
const TYPE_SWITCH = 'switch'
const TYPE_THERMO = 'thermo'
const TYPE_AQUA = 'aqua'
const TYPE_CUSTOM = 'custom'

let homebridge
let Characteristic
let Service

module.exports = function (pHomebridge) {
  if (pHomebridge && !homebridge) {
    homebridge = pHomebridge
    Characteristic = homebridge.hap.Characteristic
    Service = homebridge.hap.Service
  }

  const hexToBase64 = function (val) {
    return Buffer.from(('' + val).replace(/[^0-9A-F]/ig, ''), 'hex').toString('base64')
  }
  const base64ToHex = function (val) {
    if (!val) { return val }
    return Buffer.from(val, 'base64').toString('hex')
  }
  const swap16 = function (val) {
    return ((val & 0xFF) << 8) |
        ((val >>> 8) & 0xFF)
  }
  const swap32 = function (val) {
    return ((val & 0xFF) << 24) |
        ((val & 0xFF00) << 8) |
        ((val >>> 8) & 0xFF00) |
        ((val >>> 24) & 0xFF)
  }
  const numToHex = function (val, len) {
    let s = Number(val >>> 0).toString(16)
    if (s.length % 2 !== 0) {
      s = '0' + s
    }
    if (len) {
      return ('0000000000000' + s).slice(-1 * len)
    }
    return s
  }
  const ucfirst = function (val) {
    return val.charAt(0).toUpperCase() + val.substr(1)
  }
  const precisionRound = function (number, precision) {
    const factor = Math.pow(10, precision)
    return Math.round(number * factor) / factor
  }

  class S2R1Characteristic extends Characteristic {
    constructor () {
      super('S2R1', S2R1Characteristic.UUID)
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.READ,
          Characteristic.Perms.NOTIFY,
          Characteristic.Perms.HIDDEN
        ]
      })
    }
  }

  S2R1Characteristic.UUID = 'E863F116-079E-48FF-8F27-9C2605A29F52'

  class S2R2Characteristic extends Characteristic {
    constructor () {
      super('S2R2', S2R2Characteristic.UUID)
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.READ,
          Characteristic.Perms.NOTIFY,
          Characteristic.Perms.HIDDEN
        ]
      })
    }
  }

  S2R2Characteristic.UUID = 'E863F117-079E-48FF-8F27-9C2605A29F52'

  class S2W1Characteristic extends Characteristic {
    constructor () {
      super('S2W1', S2W1Characteristic.UUID)
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.WRITE, Characteristic.Perms.HIDDEN
        ]
      })
    }
  }

  S2W1Characteristic.UUID = 'E863F11C-079E-48FF-8F27-9C2605A29F52'

  class S2W2Characteristic extends Characteristic {
    constructor () {
      super('S2W2', S2W2Characteristic.UUID)
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.WRITE, Characteristic.Perms.HIDDEN
        ]
      })
    }
  }

  S2W2Characteristic.UUID = 'E863F121-079E-48FF-8F27-9C2605A29F52'

  class FakeGatoHistoryService extends Service {
    constructor (displayName, subtype) {
      super(displayName, FakeGatoHistoryService.UUID, subtype)

      this.addCharacteristic(S2R1Characteristic)
      this.addCharacteristic(S2R2Characteristic)
      this.addCharacteristic(S2W1Characteristic)
      this.addCharacteristic(S2W2Characteristic)
    }
  }

  FakeGatoHistoryService.UUID = 'E863F007-079E-48FF-8F27-9C2605A29F52'
  let thisAccessory = {}
  class FakeGatoHistory extends Service {
    constructor (accessoryType, accessory, optionalParams) {
      super(accessory.displayName + ' History', FakeGatoHistoryService.UUID)

      thisAccessory = accessory
      this.accessoryName = thisAccessory.displayName
      this.signatures = []
      this.uuid = require('./uuid.js')

      if (typeof (optionalParams) === 'object') {
        this.size = optionalParams.size || 4032
        this.minutes = optionalParams.minutes || 10 // Optional timer length
        this.storage = optionalParams.storage // 'fs' or 'googleDrive'
        this.path = optionalParams.path ||
          optionalParams.folder ||
          (this.storage === 'fs' ? homebridge.user.storagePath() : undefined)
        this.filename = optionalParams.filename
        this.disableTimer = optionalParams.disableTimer || false
        this.disableRepeatLastData = optionalParams.disableRepeatLastData || false
        // workaround for typescript blocking of changing of accessory object definition
        this.log = optionalParams.log || thisAccessory.log || {}
      } else {
        this.size = 4032
        this.minutes = 10
        this.disableTimer = false
        this.log = thisAccessory.log || {}
      }

      if (!this.log) {
        this.log = function () { }
      }

      if (!this.disableTimer) {
        if (homebridge.globalFakeGatoTimer === undefined) {
          homebridge.globalFakeGatoTimer = new FakeGatoTimer({
            minutes: this.minutes,
            log: this.log
          })
        }
      }

      if (this.storage !== undefined) {
        this.loaded = false
        if (homebridge.globalFakeGatoStorage === undefined) {
          homebridge.globalFakeGatoStorage = new FakeGatoStorage({
            log: this.log
          })
        }
        homebridge.globalFakeGatoStorage.addWriter(this, {
          storage: this.storage,
          path: this.path,
          filename: this.filename,
          keyPath: optionalParams.keyPath || homebridge.user.storagePath() || undefined,
          onReady: function () {
            this.load(function (err, loaded) {
              // this.log("Loaded",loaded);
              // this.registerEvents();
              if (err) this.log('Load error :', err)
              else {
                if (loaded) this.log('History Loaded from Persistant Storage')
                this.loaded = true
              }
            }.bind(this))
          }.bind(this)
        })
      }

      switch (accessoryType) {
        case TYPE_WEATHER:
          this.accessoryType116 = '03 0102 0202 0302'
          this.accessoryType117 = '07'
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, this.calculateAverage)
          }
          break
        case TYPE_ENERGY:
          this.accessoryType116 = '04 0102 0202 0702 0f03'
          this.accessoryType117 = '1f'
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, this.calculateAverage)
          }
          break
        case TYPE_ROOM:
          this.accessoryType116 = '04 0102 0202 0402 0f03'
          this.accessoryType117 = '0f'
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, this.calculateAverage)
          }
          break
        case TYPE_DOOR:
          this.accessoryType116 = '01 0601'
          this.accessoryType117 = '01'
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, function (params) { // callback
              const backLog = params.backLog || []
              const immediate = params.immediate

              const fakegato = this.service
              const actualEntry = {}

              if (backLog.length) {
                if (!immediate) {
                  actualEntry.time = Math.round(new Date().valueOf() / 1000)
                  actualEntry.status = backLog[0].status
                } else {
                  actualEntry.time = backLog[0].time
                  actualEntry.status = backLog[0].status
                }
                fakegato.log(
                  '**Fakegato-timer callbackDoor: ',
                  fakegato.accessoryName,
                  ', immediate: ',
                  immediate,
                  ', entry: ',
                  actualEntry
                )

                fakegato._addEntry(actualEntry)
              }
            })
          }
          break
        case TYPE_MOTION:
          this.accessoryType116 = '02 1301 1c01'
          this.accessoryType117 = '02'
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, function (params) { // callback
              const backLog = params.backLog || []
              const immediate = params.immediate

              const fakegato = this.service
              const actualEntry = {}

              if (backLog.length) {
                if (!immediate) {
                  actualEntry.time = Math.round(new Date().valueOf() / 1000)
                  actualEntry.status = backLog[0].status
                } else {
                  actualEntry.time = backLog[0].time
                  actualEntry.status = backLog[0].status
                }
                fakegato.log(
                  '**Fakegato-timer callbackMotion: ',
                  fakegato.accessoryName,
                  ', immediate: ',
                  immediate,
                  ', entry: ',
                  actualEntry
                )

                fakegato._addEntry(actualEntry)
              }
            })
          }
          break
        case TYPE_SWITCH:
          this.accessoryType116 = '01 0e01'
          this.accessoryType117 = '01'
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, function (params) { // callback
              const backLog = params.backLog || []
              const immediate = params.immediate

              const fakegato = this.service
              const actualEntry = {}

              if (backLog.length) {
                if (!immediate) {
                  actualEntry.time = Math.round(new Date().valueOf() / 1000)
                  actualEntry.status = backLog[0].status
                } else {
                  actualEntry.time = backLog[0].time
                  actualEntry.status = backLog[0].status
                }
                fakegato.log(
                  '**Fakegato-timer callbackSwitch: ',
                  fakegato.accessoryName,
                  ', immediate: ',
                  immediate,
                  ', entry: ',
                  actualEntry
                )

                fakegato._addEntry(actualEntry)
              }
            })
          }
          break
        case TYPE_CUSTOM:
          thisAccessory.services.forEach((service, i) => {
            service.characteristics.forEach((characteristic, i) => {
              switch (this.uuid.toLongFormUUID(characteristic.UUID)) {
                case Characteristic.CurrentTemperature.UUID: // Temperature
                  this.signatures.push({
                    signature: '0102',
                    length: 4,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 100,
                    entry: 'temp'
                  })
                  break
                case Characteristic.CurrentRelativeHumidity.UUID: // Humidity
                  this.signatures.push({
                    signature: '0202',
                    length: 4,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 100,
                    entry: 'humidity'
                  })
                  break
                case 'E863F10F-079E-48FF-8F27-9C2605A29F52': // CustomCharacteristic.AtmosphericPressureLevel.UUID
                  this.signatures.push({
                    signature: '0302',
                    length: 4,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 10,
                    entry: 'pressure'
                  })
                  break
                case 'E863F10B-079E-48FF-8F27-9C2605A29F52': // PPM
                  this.signatures.push({
                    signature: '0702',
                    length: 4,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 10,
                    entry: 'ppm'
                  })
                  break
                case Characteristic.ContactSensorState.UUID: // Contact Sensor State
                  this.signatures.push({
                    signature: '0601',
                    length: 2,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 1,
                    entry: 'contact'
                  })
                  break
                case 'E863F10D-079E-48FF-8F27-9C2605A29F52': // Power
                  this.signatures.push({
                    signature: '0702',
                    length: 4,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 10,
                    entry: 'power'
                  })
                  break
                case Characteristic.On.UUID: // Switch On
                  this.signatures.push({
                    signature: '0e01',
                    length: 2,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 1,
                    entry: 'status'
                  })
                  break
                case Characteristic.MotionDetected.UUID: // Motion Detected
                  this.signatures.push({
                    signature: '1c01',
                    length: 2,
                    uuid: this.uuid.toShortFormUUID(characteristic.UUID),
                    factor: 1,
                    entry: 'motion'
                  })
                  break
              }
            })
          })
          this.accessoryType116 = ' 0' +
            this.signatures.length.toString() +
            ' ' +
            this.signatures.sort((a, b) => {
              return a.signature > b.signature ? 1 : -1
            }).map(a => a.signature).join(' ') +
            ' '
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.subscribe(this, this.calculateAverage)
          }
          break
        case TYPE_AQUA:
          this.accessoryType116 = '03 1f01 2a08 2302'
          this.accessoryType117 = '05'
          this.accessoryType117bis = '07'
          break
        case TYPE_THERMO:
          this.accessoryType116 = '05 0102 1102 1001 1201 1d01'
          this.accessoryType117 = '1f'
          break
      }

      this.accessoryType = accessoryType
      this.firstEntry = 0
      this.lastEntry = 0
      this.history = ['noValue']
      this.memorySize = this.size
      this.usedMemory = 0
      this.currentEntry = 1
      this.transfer = false
      this.setTime = true
      this.restarted = true
      this.refTime = 0
      this.memoryAddress = 0
      this.dataStream = ''

      this.saving = false

      this.registerEvents()
      if (this.storage === undefined) {
        this.loaded = true
      }
    }

    calculateAverage (params) { // callback
      const backLog = params.backLog || []
      const previousAvrg = params.previousAvrg || {}
      const timer = params.timer

      const fakegato = this.service
      const calc = {
        sum: {},
        num: {},
        avrg: {}
      }

      for (const h in backLog) {
        if (Object.prototype.hasOwnProperty.call(backLog, h)) { // only valid keys
          for (const key in backLog[h]) { // each record
            if (Object.prototype.hasOwnProperty.call(backLog[h], key) && key !== 'time') {
              if (!calc.sum[key]) { calc.sum[key] = 0 }
              if (!calc.num[key]) { calc.num[key] = 0 }
              calc.sum[key] += backLog[h][key]
              calc.num[key]++
              calc.avrg[key] = precisionRound(calc.sum[key] / calc.num[key], 2)
            }
          }
        }
      }
      calc.avrg.time = Math.round(new Date().valueOf() / 1000) // set the time of the avrg

      if (!fakegato.disableRepeatLastData) {
        for (const key in previousAvrg) { // each record of previous average
          if (Object.prototype.hasOwnProperty.call(previousAvrg, key) && key !== 'time') {
            if (!backLog.length || calc.avrg[key] === undefined) {
              calc.avrg[key] = previousAvrg[key]
            }
          }
        }
      }

      if (Object.keys(calc.avrg).length > 1) {
        fakegato._addEntry(calc.avrg)
        timer.emptyData(fakegato)
      }
      return calc.avrg
    }

    registerEvents () {
      this.log('Registring Events', thisAccessory.displayName)
      if (typeof thisAccessory.getService === 'function') {
        // Platform API
        this.log('Platform', thisAccessory.displayName)

        this.service = thisAccessory.getService(FakeGatoHistoryService)
        if (this.service === undefined) {
          this.service = thisAccessory.addService(
            FakeGatoHistoryService,
            ucfirst(thisAccessory.displayName) + ' History',
            this.accessoryType
          )
        }

        this.service.getCharacteristic(S2R2Characteristic)
          .removeAllListeners('get')
          .on('get', this.getCurrentS2R2.bind(this))

        this.service.getCharacteristic(S2W1Characteristic)
          .removeAllListeners('set')
          .on('set', this.setCurrentS2W1.bind(this))

        this.service.getCharacteristic(S2W2Characteristic)
          .removeAllListeners('set')
          .on('set', this.setCurrentS2W2.bind(this))
      } else {
        // Accessory API
        this.log('Accessory', thisAccessory.displayName)

        this.addCharacteristic(S2R1Characteristic)

        this.addCharacteristic(S2R2Characteristic)
          .removeAllListeners('get')
          .on('get', this.getCurrentS2R2.bind(this))

        this.addCharacteristic(S2W1Characteristic)
          .removeAllListeners('set')
          .on('set', this.setCurrentS2W1.bind(this))

        this.addCharacteristic(S2W2Characteristic)
          .removeAllListeners('set')
          .on('set', this.setCurrentS2W2.bind(this))
      }
    }

    sendHistory (address) {
      if (address !== 0) {
        this.currentEntry = address
      } else {
        this.currentEntry = 1
      }
      this.transfer = true
    }

    addEntry (entry) {
      switch (this.accessoryType) {
        case TYPE_DOOR:
        case TYPE_MOTION:
        case TYPE_SWITCH:
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.addData({
              entry: entry,
              service: this,
              immediateCallback: true
            })
          } else {
            this._addEntry({
              time: entry.time,
              status: entry.status
            })
          }
          break
        case TYPE_AQUA:
          this._addEntry({
            time: entry.time,
            status: entry.status,
            waterAmount: entry.waterAmount
          })
          break
        case TYPE_WEATHER:
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.addData({
              entry: entry,
              service: this
            })
          } else {
            this._addEntry({
              time: entry.time,
              temp: entry.temp,
              humidity: entry.humidity,
              pressure: entry.pressure
            })
          }
          break
        case TYPE_ROOM:
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.addData({
              entry: entry,
              service: this
            })
          } else {
            this._addEntry({
              time: entry.time,
              temp: entry.temp,
              humidity: entry.humidity,
              ppm: entry.ppm
            })
          }
          break
        case TYPE_ENERGY:
          if (!this.disableTimer) {
            homebridge.globalFakeGatoTimer.addData({
              entry: entry,
              service: this
            })
          } else {
            this._addEntry({
              time: entry.time,
              power: entry.power
            })
          }
          break
        case TYPE_CUSTOM:
          if (!this.disableTimer) {
            if ('power' in entry || 'temp' in entry) {
              // Only put power or temperature thru averager
              homebridge.globalFakeGatoTimer.addData({
                entry: entry,
                service: this
              })
            } else {
              this._addEntry(entry)
            }
          } else {
            this._addEntry(entry)
          }
          break
        default:
          this._addEntry(entry)
          break
      }
    }

    // in order to be consistent with Eve, entry address start from 1
    _addEntry (entry) {
      if (this.loaded) {
        const entry2address = function (val) {
          return val % this.memorySize
        }
          .bind(this)

        let val

        if (this.usedMemory < this.memorySize) {
          this.usedMemory++
          this.firstEntry = 0
          this.lastEntry = this.usedMemory
        } else {
          this.firstEntry++
          this.lastEntry = this.firstEntry + this.usedMemory
          if (this.restarted) {
            this.history[entry2address(this.lastEntry)] = {
              time: entry.time,
              setRefTime: 1
            }
            this.firstEntry++
            this.lastEntry = this.firstEntry + this.usedMemory
            this.restarted = false
          }
        }

        if (this.refTime === 0) {
          this.refTime = entry.time - _EPOCH
          this.history[this.lastEntry] = {
            time: entry.time,
            setRefTime: 1
          }
          this.initialTime = entry.time
          this.lastEntry++
          this.usedMemory++
        }

        this.history[entry2address(this.lastEntry)] = (entry)

        if (this.usedMemory < this.memorySize) {
          val = Format(
            '%s00000000%s%s%s%s%s000000000101',
            numToHex(swap32(entry.time - this.refTime - _EPOCH), 8),
            numToHex(swap32(this.refTime), 8),
            this.accessoryType116,
            numToHex(swap16(this.usedMemory + 1), 4),
            numToHex(swap16(this.memorySize), 4),
            numToHex(swap32(this.firstEntry), 8))
        } else {
          val = Format(
            '%s00000000%s%s%s%s%s000000000101',
            numToHex(swap32(entry.time - this.refTime - _EPOCH), 8),
            numToHex(swap32(this.refTime), 8),
            this.accessoryType116,
            numToHex(swap16(this.usedMemory), 4),
            numToHex(swap16(this.memorySize), 4),
            numToHex(swap32(this.firstEntry + 1), 8))
        }

        if (this.service === undefined) { // Accessory API
          this.getCharacteristic(S2R1Characteristic).setValue(hexToBase64(val))
        } else { // Platform API
          this.service.getCharacteristic(S2R1Characteristic).setValue(hexToBase64(val))
        }

        this.log(
          'First entry %s: %s',
          this.accessoryName,
          this.firstEntry.toString(16)
        )
        this.log(
          'Last entry %s: %s',
          this.accessoryName,
          this.lastEntry.toString(16)
        )
        this.log(
          'Used memory %s: %s',
          this.accessoryName,
          this.usedMemory.toString(16)
        )
        this.log('116 %s: %s', this.accessoryName, val)

        if (this.storage !== undefined) {
          this.save()
        }
      } else {
        setTimeout(() => this._addEntry(entry), 100)
      }
    }

    getInitialTime () {
      return this.initialTime
    }

    setExtraPersistedData (extra) {
      this.extra = extra
    }

    getExtraPersistedData () {
      return this.extra
    }

    isHistoryLoaded () {
      return this.loaded
    }

    save () {
      if (this.loaded) {
        const data = {
          firstEntry: this.firstEntry,
          lastEntry: this.lastEntry,
          usedMemory: this.usedMemory,
          refTime: this.refTime,
          initialTime: this.initialTime,
          history: this.history,
          extra: this.extra
        }

        homebridge.globalFakeGatoStorage.write({
          service: this,
          data: typeof (data) === 'object' ? JSON.stringify(data) : data
        })
      } else {
        setTimeout(function () { // retry in 100ms
          this.save()
        }.bind(this), 100)
      }
    }

    load (cb) {
      this.log('Loading...')
      homebridge.globalFakeGatoStorage.read({
        service: this,
        callback: function (err, data) {
          if (!err) {
            if (data) {
              try {
                this.log('read data from', this.accessoryName, ':', data)
                const jsonFile = typeof (data) === 'object' ? data : JSON.parse(data)

                this.firstEntry = jsonFile.firstEntry
                this.lastEntry = jsonFile.lastEntry
                this.usedMemory = jsonFile.usedMemory
                this.refTime = jsonFile.refTime
                this.initialTime = jsonFile.initialTime
                this.history = jsonFile.history
                this.extra = jsonFile.extra
              } catch (e) {
                this.log(
                  '**ERROR fetching persisting data restart from zero - invalid JSON**',
                  e
                )
                cb(e, false)
              }
              cb(null, true)
            }
          } else {
            // file don't exists
            cb(null, false)
          }
        }.bind(this)
      })
    }

    cleanPersist () {
      this.log('Cleaning...')
      homebridge.globalFakeGatoStorage.remove({
        service: this
      })
    }

    getCurrentS2R2 (callback) {
      const entry2address = function (val) {
        return val % this.memorySize
      }.bind(this)

      if (this.currentEntry <= this.lastEntry && this.transfer) {
        this.memoryAddress = entry2address(this.currentEntry)
        for (let i = 0; i < 11; i++) {
          if (
            this.history[this.memoryAddress].setRefTime === 1 ||
            this.setTime ||
            (this.currentEntry === this.firstEntry + 1)
          ) {
            this.dataStream += Format(
              ',15%s 0100 0000 81%s0000 0000 00 0000',
              numToHex(swap32(this.currentEntry), 8),
              numToHex(swap32(this.refTime), 8)
            )
            this.setTime = false
          } else {
            this.log(
              '%s Entry: %s, Address: %s',
              this.accessoryName,
              this.currentEntry,
              this.memoryAddress
            )
            switch (this.accessoryType) {
              case TYPE_WEATHER:
                this.dataStream += Format(
                  ',10 %s%s-%s:%s %s %s',
                  numToHex(swap32(this.currentEntry), 8),
                  numToHex(swap32(
                    this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                  8
                  ),
                  this.accessoryType117,
                  numToHex(swap16(this.history[this.memoryAddress].temp * 100), 4),
                  numToHex(swap16(this.history[this.memoryAddress].humidity * 100), 4),
                  numToHex(swap16(this.history[this.memoryAddress].pressure * 10), 4)
                )
                break
              case TYPE_ENERGY:
                this.dataStream += Format(
                  ',14 %s%s-%s:0000 0000 %s 0000 0000',
                  numToHex(swap32(this.currentEntry), 8),
                  numToHex(swap32(
                    this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                  8
                  ),
                  this.accessoryType117,
                  numToHex(swap16(this.history[this.memoryAddress].power * 10), 4)
                )
                break
              case TYPE_ROOM:
                this.dataStream += Format(
                  ',13 %s%s%s%s%s%s0000 00',
                  numToHex(swap32(this.currentEntry), 8),
                  numToHex(swap32(
                    this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                  8
                  ),
                  this.accessoryType117,
                  numToHex(swap16(this.history[this.memoryAddress].temp * 100), 4),
                  numToHex(swap16(this.history[this.memoryAddress].humidity * 100), 4),
                  numToHex(swap16(this.history[this.memoryAddress].ppm), 4)
                )
                break
              case TYPE_DOOR:
              case TYPE_MOTION:
              case TYPE_SWITCH:
                this.dataStream += Format(
                  ',0b %s%s%s%s',
                  numToHex(swap32(this.currentEntry), 8),
                  numToHex(swap32(
                    this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                  8
                  ),
                  this.accessoryType117,
                  numToHex(this.history[this.memoryAddress].status, 2)
                )
                break
              case TYPE_AQUA:
                if (this.history[this.memoryAddress].status) {
                  this.dataStream += Format(
                    ',0d %s%s%s%s 300c',
                    numToHex(swap32(this.currentEntry), 8),
                    numToHex(swap32(
                      this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                    8
                    ),
                    this.accessoryType117,
                    numToHex(this.history[this.memoryAddress].status, 2)
                  )
                } else {
                  this.dataStream += Format(
                    ',15 %s%s%s%s%s 00000000 300c',
                    numToHex(swap32(this.currentEntry), 8),
                    numToHex(swap32(
                      this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                    8
                    ),
                    this.accessoryType117bis,
                    numToHex(this.history[this.memoryAddress].status, 2),
                    numToHex(swap32(this.history[this.memoryAddress].waterAmount), 8)
                  )
                }
                break
              case TYPE_THERMO:
                this.dataStream += Format(
                  ',11 %s%s%s%s%s%s 0000',
                  numToHex(swap32(this.currentEntry), 8),
                  numToHex(swap32(
                    this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                  8
                  ),
                  this.accessoryType117,
                  numToHex(swap16(this.history[this.memoryAddress].currentTemp * 100), 4),
                  numToHex(swap16(this.history[this.memoryAddress].setTemp * 100), 4),
                  numToHex(this.history[this.memoryAddress].valvePosition, 2)
                )
                break
              case TYPE_CUSTOM: {
                const result = []
                let bitmask = 0
                const dataStream = Format(
                  '%s%s',
                  numToHex(swap32(this.currentEntry), 8),
                  numToHex(swap32(
                    this.history[this.memoryAddress].time - this.refTime - _EPOCH),
                  8
                  )
                )
                for (const [key, value] of Object.entries(this.history[this.memoryAddress])) {
                  switch (key) {
                    case 'time':
                      break
                    default:
                      for (let x = 0, iLen = this.signatures.length; x < iLen; x++) {
                        if (this.signatures[x].entry === key) {
                          switch (this.signatures[x].length) {
                            case 8:
                              result[x] = Format('%s', numToHex(swap32(
                                value * this.signatures[x].factor),
                              this.signatures[x].length
                              ))
                              break
                            case 4:
                              result[x] = Format('%s', numToHex(swap16(
                                value * this.signatures[x].factor),
                              this.signatures[x].length
                              ))
                              break
                            case 2:
                              result[x] = Format('%s', numToHex(
                                value * this.signatures[x].factor,
                                this.signatures[x].length
                              ))
                              break
                          }
                          bitmask += Math.pow(2, x)
                        }
                      }
                  }
                }
                const results = dataStream + ' ' + numToHex(bitmask, 2) + ' ' +
                  result.map(a => a).join(' ')
                this.dataStream += ' ' + numToHex(
                  (results.replace(/[^0-9A-F]/ig, '').length) / 2 + 1
                ) + ' ' + results + ','
                break
              }
            }
          }
          this.currentEntry++
          this.memoryAddress = entry2address(this.currentEntry)
          if (this.currentEntry > this.lastEntry) { break }
        }
        this.log('Data %s: %s', this.accessoryName, this.dataStream)
        callback(null, hexToBase64(this.dataStream))
        this.dataStream = ''
      } else {
        this.transfer = false
        callback(null, hexToBase64('00'))
      }
    }

    setCurrentS2W1 (val, callback) {
      callback(null)
      this.log('Data request %s: %s', this.accessoryName, base64ToHex(val))
      const valHex = base64ToHex(val)
      const substring = valHex.substring(4, 12)
      const valInt = parseInt(substring, 16)
      const address = swap32(valInt)
      const hexAddress = address.toString('16')

      this.log('Address requested %s: %s', this.accessoryName, hexAddress)
      this.sendHistory(address)
    }

    setCurrentS2W2 (val, callback) {
      this.log('Clock adjust %s: %s', this.accessoryName, base64ToHex(val))
      callback(null)
    }
  }
  FakeGatoHistoryService.UUID = 'E863F007-079E-48FF-8F27-9C2605A29F52'
  return FakeGatoHistory
}

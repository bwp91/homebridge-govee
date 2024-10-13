export default {
  defaultConfig: {
    name: 'Govee',
    username: '',
    password: '',
    disableDeviceLogging: false,
    httpRefreshTime: 30,
    awsDisable: false,
    bleDisable: false,
    bleRefreshTime: 300,
    lanDisable: false,
    lanRefreshTime: 30,
    lanScanInterval: 60,
    bleControlInterval: 5,
    colourSafeMode: false,
    lightDevices: [],
    switchDevices: [],
    leakDevices: [],
    thermoDevices: [],
    fanDevices: [],
    heaterDevices: [],
    dehumidifierDevices: [],
    humidifierDevices: [],
    purifierDevices: [],
    diffuserDevices: [],
    kettleDevices: [],
    iceMakerDevices: [],
    platform: 'Govee',
  },

  defaultValues: {
    adaptiveLightingShift: 0,
    bleControlInterval: 5,
    awsColourMode: 'default',
    bleRefreshTime: 300,
    brightnessStep: 1,
    httpRefreshTime: 30,
    lanRefreshTime: 30,
    lanScanInterval: 60,
    lowBattThreshold: 20,
    showAs: 'default',
  },

  minValues: {
    adaptiveLightingShift: -1,
    bleControlInterval: 5,
    bleRefreshTime: 60,
    brightnessStep: 1,
    httpRefreshTime: 30,
    lanRefreshTime: 10,
    lanScanInterval: 30,
    lowBattThreshold: 1,
  },

  allowed: {
    lightDevices: [
      'label',
      'deviceId',
      'ignoreDevice',
      'showAs',
      'customAddress',
      'customIPAddress',
      'adaptiveLightingShift',
      'awsBrightnessNoScale',
      'awsColourMode',
      'brightnessStep',
      'scene',
      'sceneTwo',
      'sceneThree',
      'sceneFour',
      'musicMode',
      'musicModeTwo',
      'videoMode',
      'videoModeTwo',
      'diyMode',
      'diyModeTwo',
      'diyModeThree',
      'diyModeFour',
      'segmented',
      'segmentedTwo',
      'segmentedThree',
      'segmentedFour',
    ],
    switchDevices: [
      'label',
      'deviceId',
      'ignoreDevice',
      'showAs',
      'temperatureSource',
    ],
    leakDevices: ['label', 'deviceId', 'ignoreDevice', 'lowBattThreshold'],
    thermoDevices: ['label', 'deviceId', 'ignoreDevice', 'lowBattThreshold'],
    fanDevices: ['label', 'deviceId', 'ignoreDevice'],
    heaterDevices: ['label', 'deviceId', 'ignoreDevice', 'tempReporting'],
    humidifierDevices: ['label', 'deviceId', 'ignoreDevice'],
    dehumidifierDevices: ['label', 'deviceId', 'ignoreDevice'],
    purifierDevices: ['label', 'deviceId', 'ignoreDevice'],
    diffuserDevices: ['label', 'deviceId', 'ignoreDevice'],
    kettleDevices: [
      'label',
      'deviceId',
      'ignoreDevice',
      'hideModeGreenTea',
      'hideModeOolongTea',
      'hideModeCoffee',
      'hideModeBlackTea',
      'showCustomMode1',
      'showCustomMode2',
    ],
    iceMakerDevices: ['label', 'deviceId', 'ignoreDevice'],
    awsColourMode: ['default', 'rgb', 'redgreenblue'],
    showAs: [
      'default',
      'audio',
      'box',
      'cooler',
      'heater',
      'purifier',
      'stick',
      'switch',
      'tap',
      'valve',
    ],
  },

  models: {
    rgb: [
      'H6002',
      'H6003',
      'H6004',
      'H6006',
      'H6008',
      'H6009',
      'H600A',
      'H600D',
      'H6010',
      'H601A',
      'H601B',
      'H601C',
      'H601D',
      'H6042',
      'H6043',
      'H6046',
      'H6047',
      'H6049',
      'H604A',
      'H604B',
      'H604C',
      'H604D',
      'H6050',
      'H6051',
      'H6052',
      'H6054',
      'H6056',
      'H6057',
      'H6058',
      'H6059',
      'H605A',
      'H605B',
      'H605C',
      'H605D',
      'H6061',
      'H6062',
      'H6063',
      'H6065',
      'H6066',
      'H6067',
      'H606A',
      'H6071',
      'H6072',
      'H6073',
      'H6075',
      'H6076',
      'H6078',
      'H6079',
      'H607C',
      'H6083',
      'H6085',
      'H6086',
      'H6087',
      'H6088',
      'H6089',
      'H608A',
      'H608B',
      'H608C',
      'H608D',
      'H6091',
      'H6092',
      'H6093',
      'H6097',
      'H6098',
      'H6099',
      'H60A0',
      'H60A1',
      'H6104',
      'H6109',
      'H610A',
      'H610B',
      'H6110',
      'H6117',
      'H611A',
      'H611B',
      'H611C',
      'H611Z',
      'H6121',
      'H6135',
      'H6137',
      'H6141',
      'H6142',
      'H6143',
      'H6144',
      'H6148',
      'H614A',
      'H614B',
      'H614C',
      'H614D',
      'H614E',
      'H6154',
      'H6159',
      'H615A',
      'H615B',
      'H615C',
      'H615D',
      'H615E',
      'H615F',
      'H6160',
      'H6163',
      'H6167',
      'H6168',
      'H616C',
      'H616D',
      'H616E',
      'H6172',
      'H6173',
      'H6175',
      'H6176',
      'H6182',
      'H6188',
      'H618A',
      'H618C',
      'H618E',
      'H618F',
      'H6195',
      'H6198',
      'H6199',
      'H619A',
      'H619B',
      'H619C',
      'H619D',
      'H619E',
      'H619Z',
      'H61A0',
      'H61A1',
      'H61A2',
      'H61A3',
      'H61A5',
      'H61A8',
      'H61A9',
      'H61B1',
      'H61B2',
      'H61B3',
      'H61B5',
      'H61B6',
      'H61BA',
      'H61BC',
      'H61BE',
      'H61C2',
      'H61C3',
      'H61C5',
      'H61D3',
      'H61D5',
      'H61E0',
      'H61E1',
      'H61E5',
      'H61F5',
      'H6601',
      'H6602',
      'H6609',
      'H6640',
      'H6641',
      'H7005',
      'H7006',
      'H7007',
      'H7008',
      'H7012',
      'H7013',
      'H7021',
      'H7020',
      'H7021',
      'H7022',
      'H7028',
      'H7031',
      'H7032',
      'H7033',
      'H7037',
      'H7038',
      'H7039',
      'H7041',
      'H7042',
      'H7050',
      'H7051',
      'H7052',
      'H7053',
      'H7055',
      'H705A',
      'H705B',
      'H705C',
      'H705D',
      'H705E',
      'H705F',
      'H7060',
      'H7061',
      'H7062',
      'H7063',
      'H7065',
      'H7066',
      'H706A',
      'H706B',
      'H706C',
      'H7075',
      'H70A1',
      'H70A2',
      'H70B1',
      'H70B4',
      'H70BC',
      'H70C1',
      'H70C2',
      'H70C5',
      'H70D1',
      'H801C',
      'H805A',
      'H805B',
      'H805C',
      'HXXXX', // placeholder for LAN-only configured models
    ],
    rgbBT: [
      'H6001',
      'H6005',
      'H6053',
      'H6055',
      'H6101',
      'H6102',
      'H6107',
      'H6114',
      'H6116',
      'H6125',
      'H6126',
      'H6127',
      'H6138',
      'H6139',
      'H613A',
      'H613B',
      'H613C',
      'H613D',
      'H613E',
      'H613F',
      'H613G',
      'H6145',
      'H6146',
      'H6147',
      'H6161',
      'H6170',
      'H6171',
      'H6178',
      'H6179',
      'H617A',
      'H617C',
      'H617E',
      'H617F',
      'H6181',
      'H6185',
      'H6196',
      'H7001',
      'H7002',
      'H7010',
      'H7011',
      'H7015',
      'H7016',
      'H7019',
      'H7023',
      'H7024',
      'H7029',
      'H7090',
    ],
    switchSingle: ['H5001', 'H5080', 'H5081', 'H5083', 'H5086', 'H7014'],
    switchDouble: ['H5082'],
    switchTriple: ['H5160'],
    sensorLeak: ['H5054', 'H5058'],
    sensorThermo: [
      'B5178',
      'H5051',
      'H5052',
      'H5053',
      'H5055',
      'H5071',
      'H5072',
      'H5074',
      'H5075',
      'H5100',
      'H5101',
      'H5102',
      'H5103',
      'H5104',
      'H5105',
      'H5108',
      'H5174',
      'H5177',
      'H5179',
      'H5183',
      'H5190',
    ],
    sensorThermo4: ['H5198'],
    sensorMonitor: ['H5106'],
    fan: ['H7100', 'H7101', 'H7102', 'H7105', 'H7106', 'H7111'],
    heater1: ['H7130', 'H713A', 'H713B', 'H713C'],
    heater2: ['H7131', 'H7132', 'H7133', 'H7134', 'H7135'],
    dehumidifier: ['H7150', 'H7151'],
    humidifier: ['H7140', 'H7141', 'H7142', 'H7143', 'H7160'],
    purifier: ['H7120', 'H7121', 'H7122', 'H7123', 'H7124', 'H7126', 'H7127', 'H712C'],
    diffuser: ['H7161', 'H7162'],
    iceMaker: ['H7172'],
    sensorButton: ['H5122'],
    sensorContact: ['H5123'],
    sensorPresence: ['H5127'],
    kettle: ['H7170', 'H7171', 'H7173', 'H7175'],
    template: [
      'H1162', // https://github.com/bwp91/homebridge-govee/issues/422
      'H5024', // https://github.com/bwp91/homebridge-govee/issues/835
      'H5042', // https://github.com/bwp91/homebridge-govee/issues/849
      'H5043', // https://github.com/bwp91/homebridge-govee/issues/558
      'H5121', // https://github.com/bwp91/homebridge-govee/issues/913
      'H5126', // https://github.com/bwp91/homebridge-govee/issues/910
      'H5107', // https://github.com/bwp91/homebridge-govee/issues/803
      'H5109', // https://github.com/bwp91/homebridge-govee/issues/823
      'H5185', // https://github.com/bwp91/homebridge-govee/issues/804
    ],
  },

  lanModels: [
    'H6042', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6043', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6046', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6047', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6051', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6052', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6056', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6059', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H605A', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/827
    'H6061', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6062', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6063', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6065', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6066', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6067', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H606A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6072', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6073', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6076', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6078', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6079', // https://github.com/bwp91/homebridge-govee/issues/775
    'H607C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6087', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6088', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H608A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H608B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H608C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H608D', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H60A0', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H60A1', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/783
    'H610A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H610B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6110', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6117', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6141', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6143', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6144', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6159', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H615A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H615B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H615C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H615D', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H615E', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H615F', // https://github.com/bwp91/homebridge-govee/issues/904
    'H6163', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6167', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6168', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H616C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H616D', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H616E', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6172', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6173', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6175', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6176', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6182', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H618A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H618C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H618E', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H618F', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H619A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H619B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H619C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H619D', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H619E', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H619Z', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A0', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A1', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A2', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A3', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A5', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A8', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61A9', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61B1', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61B2', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61BA', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61BC', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61BE', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61C2', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61C3', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61C5', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61D3', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/757
    'H61E0', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H61E1', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H6641', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/825
    'H7012', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7013', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7021', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7028', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7033', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7038', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/795
    'H7039', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/771
    'H7041', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7042', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7050', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7051', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7052', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7053', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7055', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H705A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H705B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H705C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H705D', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H705E', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H705F', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7060', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7061', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7062', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7063', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7065', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7066', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H706A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H706B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H706C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H7075', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H70A2', // !NOT CONFIRMED! https://github.com/bwp91/homebridge-govee/issues/818
    'H70B1', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H70BC', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H70C1', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H70C2', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H805A', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H805B', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
    'H805C', // https://app-h5.govee.com/user-manual/wlan-guide (2024-07-20)
  ],

  awsOutlet1617: ['H5080', 'H5083'],

  apiBrightnessScale: ['H6002', 'H6083', 'H6085', 'H6135', 'H6137', 'H7005'],

  bleBrightnessNoScale: ['H6052', 'H6058', 'H6102', 'H613B', 'H613D', 'H617E'],

  bleColourD: ['H6052', 'H6058', 'H6102', 'H613B', 'H613D', 'H617E'], // appears the same as above

  bleColour1501: ['H6053', 'H6072', 'H6102', 'H6199'],

  httpRetryCodes: ['ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNABORTED'],
}

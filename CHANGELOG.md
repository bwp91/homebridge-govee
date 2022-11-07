# Change Log

All notable changes to homebridge-govee will be documented in this file.

⚠️ Note that Node 14 will no longer be supported after April 2023

## BETA

### Changed

- Improvements to fan accessories [WIP]
- Bump `node` recommended versions to v14.21.1 or v16.18.1 or v18.12.1

### Fixed

- Issue with using improperly saved access token
- AWS fixes for H6009

## 7.1.2 (2022-10-31) 🎃

### Changed

- Disable BLE for Mac devices as not supported (by noble)
- Cap out of range colour temperatures from Govee

### Fixed

- AWS control for H6159
- AWS fixes for H6051 and H6056

## 7.1.1 (2022-10-25)

### Fixed

- Properly catch errors when parsing notifications with invalid JSON
- AWS brightness scale for H6182

## 7.1.0 (2022-10-25)

### Added

- Store and use account access token locally if possible to avoid re-authenticating on every restart
  - Should reduce cases of 24-hour account suspensions from logging in too many times
- A `colourSafeMode` setting which will not add `ColorTemperature` to light devices
  - This should help users with old iOS devices in which the`ColorTemperature` cannot be used with `Hue` and `Saturation`

### Changed

- More features to the Govee Heater implementation
- Scene codes will now log only in debug mode
- General refactoring and code improvements
- Plugin will override and use debug logging mode if a beta version is installed

### Fixed

- Improved AWS support for H6182
- An issue parsing incoming API updates for lights
- An issue when brightness was not scaled properly for certain incoming AWS updates

## 7.0.1 (2022-10-22)

- More features to the Govee Heater implementation
- Fixed an issue with incoming AWS updates for accessories not in Homebridge
- Log all scene codes received for a device (for debugging, this is not permanent)

## 7.0.0 (2022-10-20)

### ⚠️ Config Changes

#### New

- `httpRefreshTime`
  - Default `30`, minimum `30`
- `awsRefreshTime`
  - Default `30`, minimum `30`
- `lanDisable`
  - Default `false`
- `bleDisable`
  - Default `false`
- `bleRefreshTime`
  - Default `300`, minimum `60`

#### Changed

- `refreshTime` has been renamed to `apiRefreshTime`
  - Minimum increased from `15` to `30`
- `lanStateUpdateInterval` has been renamed to `lanRefreshTime`
  - Default increased from `5` to `30`, minimum increased from `2` to `10`
- `lanScanInterval`
  - Default increased from `5` to `60`, minimum increased from `2` to `30`
- `controlInterval` has been renamed to `apiBleControlInterval`
  - Unit changed from `milliseconds` to `seconds`
  - Plugin will try to be backward compatible, dividing any existing values >=500 appropriately

### Added

- Support for AWS connection polling
- Support for H5160 3-channel outlet device
- Support for BLE-only thermo-hygrometers (integration of homebridge-plugin-govee plugin)
  - Use [govee-bt-client](https://www.npmjs.com/package/govee-bt-client) to connect to certain Govee sensor models via BLE
- Logout to close Govee session on Homebridge shutdown

### Work in Progress

- Continued improved implementation of Govee Heaters
- Support for H5103 and H5106 temperature/humidity sensors

### Changed

- Plugin no longer sends API command if AWS command was successful
- Plugin no longer requests device state via LAN immediately after sending a command
- Bump `axios` to v1.1.3
- Bump `node` recommended versions to v14.20.1 or v16.18.0 or v18.11.0

### Fixed

- Multiple general fixes
- Fixes H5054 leak sensor status reporting (again)
- Fixes an incorrect error when changing speed of appliances like heaters and humidifiers

## 6.0.4 (2022-10-07)

### Changed

- Small timeout to ignore incoming LAN updates when controlled, workaround for incorrect status updates when controlling via LAN
- Bump `axios` to v1.1.2

## 6.0.3 (2022-10-06)

### Changed

- Use configured `label` for accessory name for LAN-only models

## 6.0.2 (2022-10-06)

### Fixed

- Ignore `offlineAsOff` for LAN-only devices
- Remove scene characteristics from LAN-only devices as unsupported

## 6.0.1 (2022-10-06)

### Fixed

- A couple of small fixes for when using a custom IP address for LAN control

## 6.0.0 (2022-10-05)

### Added

- 🎉 LAN mode! 🎉 (thanks [@alboiuvlad29](https://github.com/alboiuvlad29)!)
  - See [the homebridge-govee wiki](https://github.com/bwp91/homebridge-govee/wiki/Supported-Devices) for supported devices
  - The plugin will scan your local network for supported Govee lights
  - You can also specify the IP address of your Govee light in the config
  - The plugin will match any discovered devices to your existing accessories from cloud usage
  - Supported LAN controls are on/off, brightness, colour and colour temperature
  - The plugin will initially attempt LAN control, if this fails then it will fall back to cloud control
- **New Devices**
  - Via Govee Developer API v2.0:
    - **Lights**: H61A5, H6078, H604D, H6168, H6601, H70B1, H61A8 
    - **Fans:** H7101, H7111
    - **Heaters:** H7130, H7131, H7132
    - **Dehumidifiers:** H7150
    - **Humidifiers:** H7141, H7142, H7160
    - **Purifiers:** H7120, H7121, H7122, H7123
  - Via AWS Connection:
    - **Kettles:** H7170 (ability just to switch on)
  - Via Bluetooth:
    - **Lights:** H617E bluetooth light strip

### Changed

- **Revert:** Bluetooth-only devices no longer need to be configured to explicitly enable bluetooth
- Less bluetooth logging when not in debug mode
- AWS improvements for H615D
- AWS improvements for H7050/H7051 (thanks [@alboiuvlad29](https://github.com/alboiuvlad29)!)
- Correct parameters for `updatePlatformAccessories()`
- Bump `node` recommended versions to v14.20.1 or v16.17.1
- Allow for `node` v18.10.0
- Bump `homebridge` recommended version to v1.5.0
- Bump `axios` to v1.0.0
- Updated dev dependencies

### Fixed

- Fixed H5054 leak sensor status reporting

### Removed

- Removed the `disableAWS` option for lights
  - *This option was implemented when AWS was introduced as a way to disable it for lights that didn't work with it, but now that it's been tested on more lights, it's no longer needed*

## 5.2.0 (2022-06-13)

### Added

- **New Devices** via Govee Developer API v1.8
  - H601A, H6046, H6047, H604C, H6057, H605C, H6065, H610B, H61A3, H61E1, H7055, H705A, H705B, H7065

## 5.1.0 (2022-06-08)

### Added

- **New Devices**
  - H7123 Air Purifier
  - H7160 Humidifier

### Changed

- Bump `node` recommended versions to v14.19.3 or v16.15.1

### Fixed

- A potential issue showing errors in the logs
- AWS improvements for H618E

## 5.0.1 (2022-05-28)

### Changed

- Try BLE-only device connection for 8 seconds and 4 seconds for API/AWS models
- More fixes and refactoring

## 5.0.0 (2022-05-28)

### Potentially Breaking Changes

⚠️ The minimum required version of Homebridge is now v1.4.0
⚠️ The minimum required version of Node is now v14

### Changed

- Device polling based on number of devices and new Govee limitations
- Bluetooth-only devices no longer need to be configured to explicitly enable bluetooth
- Changed to ESM package
- Bump `node` recommended versions to v14.19.3 or v16.15.0

## 4.30.3 (2022-04-10)

### Fixed

- An issue updating colour for certain RGB models

## 4.30.2 (2022-04-03)

### Changed

- Updated dependencies

## 4.30.1 (2022-04-01)

### Changed

- Bump `aws-iot-device-sdk` to v2.2.12
- Improve AWS support for H6008, H604A, H6056 and H6073

## 4.30.0 (2022-03-20)

### Added

- Support new models via Govee API v1.5:
  - H6009, H604A, H604B, H605D, H6066, H6067, H6091, H615E, H6173, H618F, H61A1, H61A2, H61B2, H7031, H7032, H7041, H7042, H7051, H7061, H7062
- Added H6101, H6116 to bluetooth only light strips

### Changed

- Bump `axios` to v0.26.1
- Bump `node` recommended versions to v14.19.1 or v16.14.2

## 4.29.0 (2022-02-27)

### Added

- Added H604A and H613B to bluetooth only light strips

### Changed

- Bump `node` recommended versions to v14.19.0 or v16.14.0
- Bump `axios` to v0.26.0

### Fixed

- Colour support for H613B and H613D via bluetooth, thanks @jbheuschen
- Improved AWS support for H610A, H6144, H6159, H6172, H61A0, H619C and H619E
- Improved AWS support for H6052 thanks @DuckMasterAl

## 4.28.0 (2022-02-02)

### Added

- Initial support for Govee Fans H7101 and H7111
- Heating speed and oscillation support for Govee Heater (via `RotationDirection` feature)

### Changed

- Bump `homebridge` recommended version to v1.4.0
- Bump `axios` to v0.25.0

### Fixed

- Brightness fix for H6050
- Improved AWS support for H6072 and H6141

## 4.27.0 (2022-01-15)

### Added

- Added H6178 and H617A to bluetooth only light strips
- Added lock control and display light control to Govee Purifiers

## Fixed

- Improved AWS support for H6058 and H605B

## 4.26.0 (2022-01-13)

### Added

- Speed control for Govee Purifiers

### Changed

- Plugin startup logs will include the model in the device listing
- Purifier, Heater and Humidifier will no longer debug log (was hard-coded for development)
- Bump `node` recommended versions to v14.18.3 or v16.13.2

### Fixed

- Improved AWS support for H6141
- Incorrectly marking AWS-only devices as command failed when it was in fact sent

## 4.25.0 (2022-01-09)

### Added

- Added two custom scene options called 'Video Mode' for video mode scenes

### Fixed

- Properly display a certain error from `bluetooth-hci-socket`
- Properly throw an error if bluetooth fails and is the only connection method
- Missing RGB data for selecting 5600K colour temperature

## 4.24.0 (2022-01-08)

### Added

- Reinstate support for H6001

### Fixed

- Improved AWS support for H6062

## 4.23.2 (2022-01-07)

### Fixed

- Improved AWS support for H6003, H6054, H6199
- Plugin crash for older versions of Homebridge

## 4.23.1 (2021-01-05)

### Fixed

- Improved AWS support for H619A

## 4.23.0 (2022-01-03)

### Added

- **Logging**
  - Plugin will log if it notices your device supports the `color/rgb` AWS command, asking to let me know on Github

### Fixed

- Colour and colour temperature fixes for the H6086

## 4.22.0 (2021-12-31)

See ⚠️ for potentially-breaking changes.

### Added

- **New Devices**
  - Added H6005 to bluetooth only light strips
  - Added H5071 to thermo-hygrometer devices

### Changed

- Bump `homebridge` recommended version to v1.3.9

### Fixed

- Fixed sending and receiving colour temperature values with `colorwc` AWS command

### Removed

- ⚠️ Remove support for bluetooth-only thermo-hygrometer devices
  - The plugin will log a recommendation to use `homebridge-plugin-govee`

## 4.21.0 (2021-12-30)

### Added

- **New Devices**
  - Added H6196 to bluetooth only light strips
- **Logging**
  - Plugin will log if it notices your device supports the `colorwc` AWS command, asking to let me know on Github

### Changed

- Improved support for colour temperature for devices that support `colorwc` AWS command
- Plugin will log HAPNodeJS version on startup

## 4.20.3 (2021-12-29)

### Fixed

- Use `colorwc` AWS command for H6059 and H6143 for colour

## 4.20.2 (2021-12-26)

### Fixed

- Hide error stack info for more known warnings on plugin startup

## 4.20.1 (2021-12-24)

### Fixed

- Sending colour updates via BLE was sometimes incorrectly marked as not supported
- A `Disabling HTTP client as server is busy` message
- AWS brightness fix for H6059

## 4.20.0 (2021-12-21)

### Added

- **New Devices**
  - Added H613E to bluetooth only light strips
  - Added H5174 to thermo-hygrometer devices (although not properly supported since BLE-only)
- **Simulations**
  - Expose an outlet device as a `Heater` or `Cooler` accessory type, using the current temperature value from another Govee, eWeLink or Meross sensor (eWeLink and Meross sensors will not work with HOOBS)
  - Current temperature values from sensors will be cached in the homebridge storage directory to allow my other plugins to create `Heater` and `Cooler` accessories with the temperature values

### Changed

- Some config options rearranged for easier access
- Only use the (promise) queue for API updates, ie, don't use the queue for AWS and BLE updates

## 4.19.0 (2021-12-08)

### Added

- **New Devices**
  - On/Off capability for Govee Purifiers H7121 and H7122
  - Support for Govee Humidifier H7142
  - Added H6055, H6114, H6145, H6146, H7010, H7001, H7002, H7011, H7015, H7016, H7023, H7024 and H7090 to bluetooth only light strips
- **Simulations**
  - Expose a single switch as an `Audio Receiver`, `Set Top Box`, `Streaming Stick`, `Tap/Faucet`, or `Valve` HomeKit accessory type

### Changed

- In debug mode, the plugin will log all bluetooth devices discovered when trying to control a light
  - This can help identify whether bluetooth is working and to find the address of a light strip if the plugin cannot automatically determine it
- Bump `homebridge` recommended version to v1.3.8
- Bump `node` recommended versions to v14.18.2 or v16.13.1

### Fixed

- Avoid repeated logging for state changes of certain accessories
- Properly remove ignored accessories from the Homebridge cache

## 4.18.0 (2021-11-18)

### Added

- **New Devices**
  - Added H613D to bluetooth only light strips
  - Added H5177 to thermo-hygrometer devices
  - Added H605B, H6087, H6172, H619B, H619D, H619Z, H610A, H6059, H7028, H6198 and H6049 to API enabled models
  - Added H61A0 and H7060 to API enabled models and removed from BLE-only models

### Fixed

- AWS brightness fix for H6003, H6008 and H6062
- AWS colour fix for H6003

## 4.17.0 (2021-11-03)

### Added

- **New Devices**
  - Added H5100 to thermo-hygrometer devices
  - Added H617C to bluetooth only light strips
  - Govee Heater H7130 partial implementation
  - Govee Humidifier H7141 partial implementation

### Changed

- Configuration text label from `username` to `email` for clarification
- Revert back from `@homebridge/noble` to `@abandonware/noble`

## 4.16.0 (2021-10-31)

### Added

- **New Devices**
  - Added H613A to bluetooth only light strips
  - Added H613C to bluetooth only light strips
  - Added H61A0 to bluetooth only light strips
- **Logging**
  - AWS account topic and device topics will now be redacted from the Homebridge log

### Changed

- Bump `node` recommended versions to v14.18.1 or v16.13.0
- Bump `axios` to v0.24.0

## 4.15.0 (2021-10-20)

### Added

- **New Devices**
  - Added H5102 to temperature/humidity sensors

### Changed

- Some small changes to Fakegato debug logging

## 4.14.0 (2021-10-16)

### Added

- **New Devices**
  - Added H5074 to temperature/humidity sensors
  - Added H613C to bluetooth only light strips

### Changed

- Recommended node versions bumped to v14.18.1 or v16.11.1
- Recommended Homebridge bumped to v1.3.5
- Bump `axios` to v0.23.0

### Fixed

- H6072 brightness and colour commands don't work with AWS

## 4.13.1 (2021-10-03)

### Changed

- Updated bluetooth dependencies

## 4.13.0 (2021-10-03)

### Added

- **New Devices**
  - Added H6170 to bluetooth only light strips

### Changed

- Bump `axios` to v0.22.0

## 4.12.3 (2021-09-30)

### Changed

- Recommended node versions bumped to v14.18.0 or v16.10.0

## 4.12.2 (2021-09-25)

### Fixed

- 'Segmented' scenes not being added correctly

## 4.12.1 (2021-09-25)

### Changed

- Use `@homebridge/noble` repo to fix noble `EALREADY` crash

## 4.12.0 (2021-09-21)

### Added

- Added four more custom scene options called 'Segmented' for segmented light scenes
- Added the option to use an AWS code using the `bulb` AWS command property

## 4.11.0 (2021-09-14)

### Added

- **New Devices**
  - Added `H5082` to dual outlet devices
- New `offlineAsOff` setting to show offline devices as OFF in HomeKit

### Fixed

- Don't throw error when **only** AWS update is used
- Disable colour commands via AWS/BLE for `H6199` as seems not supported

## 4.10.0 (2021-09-09)

### Added

- **New Devices**
  - Added `H5053` to temperature/humidity sensors supported list

### Changed

- `configureAccessory` function simplified to reduce chance of accessory cache retrieval failing
- Bump `axios` to v0.21.4

## 4.9.0 (2021-09-05)

### Added

- **New Devices**
  - Added `H6147` to bluetooth-only supported list

### Changed

- Recommended node version bumped to v14.17.6
- Bump `axios` to v0.21.3

## 4.8.0 (2021-08-30)

### Added

- Added `H5072` to not-supported list

### Changed

- Remove `node-machine-id` in favour of generating a client id based on Govee username
- AWS client id is now unique per device

## 4.7.0 (2021-08-26)

### Added

- **New Devices**
  - Added `H6102` to bluetooth-only supported list

## 4.6.0 (2021-08-22)

### Added

- **New Devices**
  - Added `H6179` to bluetooth-only supported list

## 4.5.0 (2021-08-16)

### Added

- **New Devices**
  - Added `H6138` to bluetooth-only supported list
  - Added `H6001` to not-supported list (model must use undocumented bluetooth commands)

### Changed

- **Unsupported Devices**
  - Plugin will remove existing accessories whose model is unsupported
- **Platform Versions**
  - Recommended node version bumped to v14.17.5

### Fixed

- More specific-case logging when device updates fail (eg not displaying reverting to API if not unsupported API model)
- Plugin will ignore incoming AWS updates when controlling colour temperature as can sometimes incorrectly disable adaptive lighting
- Attempt to fix a situation when `node-machine-id` fails to obtain the machine uuid
- Attempt to fix a situation when the plugin would crash Homebridge in a loop if running on a non-macOS platform with no bluetooth module

## 4.4.1 (2021-08-10)

### Fixed

- Removed H6144 from 'scale brightness' list, fixes [#99](https://github.com/bwp91/homebridge-govee/issues/99)

## 4.4.0 (2021-08-09)

### Added

- **New Devices**
  - Added `H5051` to temp/humidity sensor supported list
  - Added new API models: `H7050` `H6051` `H6056` `H6061` `H6058` `H6073` `H6076` `H619A` `H619C` `H618A` `H618C` `H6008` `H6071` `H6075` `H614A` `H614B` `H614E` `H618E` `H619E`

## 4.3.0 (2021-08-05)

### Added

- **New Devices**
  - Added `H5101` to temp/humidity sensor supported list

### Changed

- **AWS Codes**
  - ⚠️ The format of the code that the plugin needs has changed
    - You will need to re-obtain your AWS codes using the same method as before and save them into the configuration

### Fixed

- Fixes an issue preventing outlet devices from initialising

## 4.2.0 (2021-08-04)

### Added

- **New Devices**
  - Added `H6126` to bluetooth-only supported list

### Fixed

- Fixes an issue where AWS was not being enabled for non-configured light strips

## 4.1.0 (2021-08-04)

### Added

- **Govee Lights**
  - Support for two more custom scene codes and two mode custom diy mode codes
- **New Devices**
  - Added `H6125` to bluetooth-only supported list

### Fixed

- **Logging**
  - Certain common errors made easier to read
  - Stringify new device objects so they appear in HOOBS log

## 4.0.2 (2021-07-30)

### Changed

- A log warning for certain models which use a different data format for scenes

### Fixed

- Adaptive Lighting will now be turned off when using the Govee app to use a scene for these certain models

## 4.0.1 (2021-07-29)

### Fixed

- An issue where custom scenes weren't visible in Eve app

## 4.0.0 (2021-07-29)

### Added

- **New Devices**
  - Added `H6127` to the bluetooth only model list
  - Added `H6171` to the bluetooth only model list
- **Configuration**
  - Plugin will now check for duplicate device ID entries in the config and ignore them

### Changed

- ⚠️ **Platform Versions**

  - Recommended node version bumped to v14.17.4
  - Recommended homebridge version bumped to v1.3.4

- ⚠️ **AWS Control**
  - AWS connection is now **enabled** by default for Govee Lights that support this mode
    - If for any reason you want to disable this then there is a new 'Disable AWS Control' setting

### Fixed

- Older models may supply device id in a format without colons and in lowercase (plugin reformats)
- Use device ble address that Govee sometimes supplies rather than calculating from existing device id
- Removed `H6141` from bluetooth only model list as is in fact wifi too

### Removed

- 'Experimental' labels have been removed from AWS control, BLE control and scene mode settings
  - Whilst maybe not perfect(!), a lot of users have had success with both connection methods

## 3.8.0 (2021-07-27)

### Added

- `H6053` and `H6141` light models to bluetooth-only supported list
- Optionally use a base64 encoded version of your Govee password in the configuration

## 3.7.0 (2021-07-22)

### Added

- **New Devices**
  - Support for the H5075 Thermo-Hygrometer via wifi connection
    - Readings may not be reliable. Recommended to use homebridge-plugin-govee to connect over bluetooth.
- **Govee Lights**
  - Added support for colour temperature control over AWS connection
  - Plugin will apply 'ignore timeout' for incoming API updates if incoming update received over AWS

### Changed

- **Govee Lights**

  - Plugin now uses a fix list of kelvin to RGB calculations (not a formula) which are the values that Govee uses
  - Reduced 'ignore timeout' from 2 minutes to 1 minute as Govee API reaction times seem to have improved

## 3.6.0 (2021-07-20)

### Added

- **Experimental AWS Control**
  - This release includes a new connection method for certain Govee Light models - AWS control - which can improve response times when controlling lights (AWS control is a real-time persistent connection)
  - As with the bluetooth connection, this is still experimental and will only be enabled if explicitly enabled in the plugin settings
  - You can check whether your model supports this connection method in the Homebridge plugin settings UI on the 'My Devices' tab
  - The different connection methods work with each other so it is possible to enable both AWS and bluetooth control for your lights
- **Scenes/Music/DIY Modes**
  - If you Govee Lights support AWS or bluetooth connection, you can use the plugin settings and the Eve app to setup HomeKit scenes for your Govee scenes, music mode and DIY modes that you have created in the Govee app. Check the wiki for more information.
- **New Devices**
  - Support for the H5179 Thermo-Hygrometer via wifi connection
  - Experimental support for the H5054 Leak Sensor via wifi connection
  - The plugin will now log extra information for devices that are not currently supported to be included in a Github issue to see whether support can be enabled for more models in the future

### Changed

- A bluetooth connection will no longer disconnect and reconnect to the same lights if the connection still exists from a previous update
- Certain bluetooth (noble) warnings will now only appear in the log when the plugin is in debug mode

### Fixed

- A number of bugs/problems concerning the bluetooth packages and connection
- An issue preventing Govee Outlets from initialising into Homebridge

## 3.5.1 (2021-07-14)

### Changed

- Bluetooth device disconnection log message only shown in debug mode

### Fixed

- A bug preventing accessories being added to Homebridge
- A characteristic warning when an out of range brightness is received from Govee

## 3.5.0 (2021-07-14)

### Added

- Support for AWS control of certain devices
- Structure for supporting Govee leak sensors

### Changed

- Continued bluetooth control changes

### Fixed

- An issue where bluetooth control wasn't adhering to the configuration

## 3.4.4 (2021-07-13)

## 3.4.3 (2021-07-13)

## 3.4.2 (2021-07-13)

### Changed

- Continued refactoring and testing of bluetooth implementation

## 3.4.1 (2021-07-12)

### Changed

- Try sending colour temperature over bluetooth for models with cold/warm leds
- Small changes to logging, makes it clearer when updates are sent/received over bluetooth or cloud

### Fixed

- An issue where brightness would be repeatedly logged if the received value is more than `100`

## 3.4.0 (2021-07-12)

### Added

- Support for Bluetooth control for power/brightness/colour for supported devices
  - Extra packages may need to be installed on your system - [see wiki](https://github.com/bwp91/homebridge-govee/wiki/Bluetooth-Control)
  - Enter your Govee username and password in the config
  - Create an entry for your light in the 'Light Devices' section and check 'Enable Bluetooth Control'

### Changed

- **Homebridge UI**
  - `label` field now appears first in the device configuration sections
  - A device can now be ignored/removed from Homebridge by the `ignoreDevice` setting in the device configuration sections

### Removed

- `ignoredDevices` configuration option (see alternate way of ignore a device above)

## 3.3.2 (2021-07-08)

### Changes

- Revert node version bump to v14.17.3 (back to v14.17.2)

## 3.3.1 (2021-07-07)

## Fixed

- Brightness issue for H6054

## 3.3.0 (2021-07-06)

### Added

- **Govee Outlets**
  - `showAs` setting to expose Govee outlet devices as a `Switch` or `AirPurifier` accessory in HomeKit
- **Govee Lights**
  - Remove Adaptive Lighting feature from a device by setting the `adaptiveLightingShift` to `-1`
- **Accessory Logging**
  - `overrideLogging` setting per device type (to replace the removed `overrideDisabledLogging`), which can be set to (and will override the global device logging and debug logging settings):
    - `"default"` to follow the global device update and debug logging setting for this accessory (default if setting not set)
    - `"standard"` to enable device update logging but disable debug logging for this accessory
    - `"debug"` to enable device update and debug logging for this accessory
    - `"disable"` to disable device update and debug logging for this accessory

### Changed

- ⚠️ Govee outlet devices (currently exposed as a `Switch`) will now be exposed as an `Outlet` by default
- Light devices will now turn on to the previous brightness (not 100%) when turning on after setting brightness to 0%
- More interactive Homebridge UI - device configuration will expand once device ID entered
- Small changes to the startup logging
- Recommended node version bump to v14.17.3

### Removed

- `overrideDisabledLogging` setting for each accessory type

## 3.2.4 (2021-06-06)

### Changed

- Switch list of 'models to not scale brightness' to a list of 'models **to** scale brightness'
- Use `standard-prettier` code formatting
- Recommended node version bump to v14.17.0

## 3.2.3 (2021-05-10)

### Changed

- Round kelvin value sent to Govee to nearest 100
- Skip Adaptive Lighting update if kelvin value is same as previous update
- Show light as off if brightness set to 0%

## 3.2.2 (2021-05-10)

### Removed

- Removed `language` config option

## 3.2.1 (2021-05-10)

### Removed

- Removed `forceUpdates` config option - this is now hard-coded to `true`

## 3.2.0 (2021-05-10)

### Added

- Support for new outlet devices:
  - `H5080`
- Support for new RGB devices:
  - `H6062` `H6072`
  - `H611A` `H611B` `H611C` `H611Z` `H6121` `H614C` `H614D` `H615A` `H615B` `H615C` `H615D` `H6154`
  - `H7006` `H7007` `H7008` `H7012` `H7013` `H7020`
- Use minimum and maximum kelvin reported per devices for models that support this
- Show minimum and maximum kelvin values reported by device in plugin-ui

### Changed

- Catch polling '400' error separately and only show in logs when in debug mode
- Reduce 'No Response' timeout to 2 seconds
- Ensure user is using at least Homebridge v1.3.0

### Fixed

- Brightness fix for H6052
- Update the correct corresponding characteristic after the 'No Response' timeout

## 3.1.4 (2021-05-04)

### Changed

- Accessory 'identify' function will now add an entry to the log
- Backend refactoring, function and variable name changes

### Removed

- Removal of device 'retrievable' and 'controllable' status as they seem to serve no purpose

## 3.1.3 (2021-04-24)

### Changed

- Use `colorTem` for colour temperature updates for devices that support this command
  - This will use the white LEDs on devices that have them
- Include a link in the 'device offline' log message for further details of this issue

### Fixed

- Fixes a brightness issue with the H6143 model

## 3.1.2 (2021-04-16)

### Changed

- Recover accessories from the cache using the UUID
- Update wiki links in the Homebridge plugin-ui

### Fixed

- Fix characteristic NaN warning for `LastActivation`

## 3.1.1 (2021-04-12)

### Changed

- Updated plugin-ui 'Support' page links to match GitHub readme file

## 3.1.0 (2021-04-07)

### Added

- `forceUpdates` configuration option for force-sending device updates even if Govee is reporting your devices as offline

### Changed

- Updated README to reflect minimum supported Homebridge/HOOBS and Node versions
- Updated recommended Node to v14.16.1

### Removed

- Removed development code for scene support

## 3.0.0 (2021-04-03)

### Requirements

- **Homebridge Users**

  - This plugin has a minimum requirement of Homebridge v1.3.3

- **HOOBS Users**
  - This plugin has a minimum requirement of HOOBS v3.3.4

### Changed

- Use the new `.onSet` methods available in Homebridge v1.3
- Plugin will report 'offline' devices with a 'No Response' message in HomeKit apps when controlled (and this status will be reverted after 5 seconds)

## 2.14.2 (2021-03-22)

### Changed

- Updated plugin ui to use reported `online` status for the 'Cloud Status' instead of the reported `controllable` status

## 2.14.1 (2021-03-21)

### Fixed

- Fixes an issue with online/offline status as certain devices seem to report status as a boolean (not as a string)

## 2.14.0 (2021-03-21)

### Added

- Device online/offline status logging to make it clearer if a device is connected to wifi

### Changed

- **Light devices** will now send on/off commands **after** brightness and colour ([#56](https://github.com/bwp91/homebridge-govee/issues/56))
- More welcome messages
- Updated `plugin-ui-utils` dependency

## 2.13.2 (2021-03-17)

### Changed

- Modified config schema to show titles/descriptions for non Homebridge UI users

## 2.13.1 (2021-03-14)

### Changed

- Adaptive Lighting now requires Homebridge 1.3 release

## 2.13.0 (2021-03-01)

### Added

- A `label` setting per device group which has no effect except to help identify the device when editing the configuration
- Show a red/green icon in the Homebridge plugin-ui to show device reachability
- Plugin will automatically retry HTTP connection on startup in the event of certain error codes
- **In Development**
  - A configuration option to expose four non-working scenes per light device
  - The idea of this is to experiment with how scenes could work if Govee enable this functionality through the API
  - The scene buttons that appear have **no** effect except logging what should happen

### Changed

- Less strict threshold for determining a 'significant' colour change for disabling Adaptive Lighting
- Show a more user friendly log message on timeout error from Govee
- 502 and timeout errors will be hidden from the log if one has already been received during the previous minute
- Updated minimum Node to v14.16.0

## 2.12.2 (2021-02-17)

### Changed

- In debug mode, the plugin will log each device's customised options when initialised

## 2.12.1 (2021-02-17)

### Changed

- Raised minimum Homebridge beta required for Adaptive Lighting to 1.3.0-beta.58

## 2.12.0 (2021-02-13)

### Added

- A configurable minimum brightness step per Govee light bulb/strip
- The ability to explicitly enable device logging _per_ device if you have `disableDeviceLogging` set to `true`

### Changed

- Show a more user friendly log message on 502 error from Govee
- Stop subsequent warning messages if a device fails to initialise
- Changes to colour conversion:
  - Lighter colours appear brighter
  - Solid red is now easier to obtain via the Home app

## 2.11.2 (2021-02-11)

### Changed

- Suitable range for `adaptiveLightingShift` added to description
- Link to 'Uninstall' wiki page in the plugin-ui
- Updated minimum Homebridge to v1.1.7
- Fakegato library formatting and simplification

### Removed

- Removed concurrency limit from http queue as throttling is based on the interval and cap

## 2.11.1 (2021-02-10)

### Changed

- Updated minimum node to v14.15.5

### Fixed

- Fixes an issue when initialising switch devices

## 2.11.0 (2021-02-09)

### Added

- 'Light Devices' config section where you can define settings per device, starting with:
  - New `adaptiveLightingShift` option to offset the Adaptive Lighting values to make the light appear warmer
- Eve history service for Govee Wi-Fi switches

### Changed

- User inputted Govee device IDs will now be parsed more thoroughly

### Fixed

- Fixed a bug when trying to select a different device in the Homebridge plugin-ui

## 2.10.1 (2021-02-08)

### Changed

- Improvements to colour temperature conversion

### Fixed

- Fixed a bug where Adaptive Lighting would not be disabled if the colour was changed from the Govee app
- Hide the `Config entry [plugin_map] is unused and can be removed` notice for HOOBS users

## 2.10.0 (2021-02-08)

### Added

- Configuration setting `controlInterval` to change the 7500ms delay introduced in v2.9.0
  - This setting is visible in the Homebridge plugin UI screen under 'Optional Settings'
  - The default value for this setting will be 500ms but if you experience connectivity issues I would suggest increasing this number (by multiples of 500) until you find a value which works well for you

### Changed

- Error stack will be hidden when the disabled plugin message appears in the log
- More colour conversation formula changes

### Fixed

- Brightness fix for the H6003

## 2.9.0 (2021-02-06)

### Added

- This release hopes to bring more reliability when using HomeKit scenes and device groupings, by using:
  - A queueing system for device updates (HTTP requests) to replace the random delays
  - Delays between HTTP requests are set to 7.5 seconds which seems to work reliably
  - The refresh interval for device sync will skip whilst device updates are being sent
- Configuration checks to highlight any unnecessary or incorrectly formatted settings you have
- Link to 'Configuration' wiki page in the plugin-ui

### Changed

- ⚠️ `ignoredDevices` configuration option is now an array not a string
- If a device's current status cannot be retrieved then the log message will only be displayed in debug mode
- Colour conversation formula changes
- Error messages refactored to show the most useful information
- [Backend] Major code refactoring
- [Backend] Code comments

## 2.8.4 (2021-01-29)

### Changed

- More consistent and clearer error logging
- Minor code refactors
- Updated plugin-ui-utils dep and use new method to get cached accessories

### Fixed

- H6109 brightness fix

## 2.8.3 (2021-01-24)

### Fixed

- H6195 brightness fix

## 2.8.2 (2021-01-24)

### Changed

- Backend - better handling of errors

## 2.8.1 (2021-01-21)

### Changed

- Minimum Homebridge beta needed for Adaptive Lighting bumped to beta-46.

## v2.8.0 (2021-01-18)

### Changed

- Plugin will log incoming device updates in `debug` mode
  - For standard usage I would recommend to have plugin `debug` mode set to OFF/FALSE, as this change will add an update to your log every X seconds depending on your refresh interval (which is 15 seconds by default)

### Fixed

- Brightness fix for `H7022` model

## v2.7.3 (2021-01-14)

### Changed

- Expose H5001, H5081 and H7014 as switches (not lightbulbs)
- Ensures brightness value is in [0, 100]

## 2.7.1 (2021-01-13)

### Changed

- Created CHANGELOG.md

### Fixed

- Brightness fix for H6188

## 2.7.0 (2021-01-12)

### New

- New configuration option `disableDeviceLogging` to stop device state changes being logged

### Changed

- Improved validation checks and formatting for user inputs
- Changes to startup log messages
- Backend code changes

### Removed

- Removal of maximum value for `number` types on plugin settings screen

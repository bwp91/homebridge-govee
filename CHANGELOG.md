# Change Log

All notable changes to this homebridge-govee will be documented in this file.

## BETA

### Added

* Support for new outlet devices:
  * `H5080`
* Support for new RGB devices:
  * `H6062` `H6072`
  * `H611A` `H611B` `H611C` `H611Z` `H6121` `H614C` `H614D` `H615A` `H615B` `H615C` `H615D` `H6154`
  * `H7006` `H7007` `H7008` `H7012` `H7013` `H7020`
* Use minimum and maximum kelvin reported per devices for models that support this
* Show minimum and maximum kelvin values reported by device in plugin-ui

### Changes

* Brightness fix for H6052
* Catch polling '400' error separately and only show in logs when in debug mode
* Reduce 'No Response' timeout to 2 seconds
* Update the correct corresponding characteristic after the 'No Response' timeout
* Ensure user is using at least Homebridge v1.3.0

## 3.1.4 (2021-05-04)

### Changes

* Accessory 'identify' function will now add an entry to the log
* Removal of device 'retrievable' and 'controllable' status as they seem to serve no purpose
* Backend refactoring, function and variable name changes

## 3.1.3 (2021-04-24)

### Changes

* Use `colorTem` for colour temperature updates for devices that support this command
  * This will use the white LEDs on devices that have them
* Fixes a brightness issue with the H6143 model
* Include a link in the 'device offline' log message for further details of this issue

## 3.1.2 (2021-04-16)

### Changes

* Fix characteristic NaN warning for `LastActivation`
* Recover accessories from the cache using the UUID
* Update wiki links in the Homebridge plugin-ui

## 3.1.1 (2021-04-12)

### Changes

* Updated plugin-ui 'Support' page links to match GitHub readme file

## 3.1.0 (2021-04-07)

### Added

* `forceUpdates` configuration option for force-sending device updates even if Govee is reporting your devices as offline

### Changes

* Removed dev code for scene support
* Updated README to reflect minimum supported Homebridge/HOOBS and Node versions
* Updated recommended Node to v14.16.1

## 3.0.0 (2021-04-03)

### Requirements

* **Homebridge Users**
  * This plugin has a minimum requirement of Homebridge v1.3.3

* **HOOBS Users**
  * This plugin has a minimum requirement of HOOBS v3.3.4

### Changes

* Use the new `.onSet` methods available in Homebridge v1.3
* Plugin will report 'offline' devices with a 'No Response' message in HomeKit apps when controlled (and this status will be reverted after 5 seconds)

## 2.14.2 (2021-03-22)

### Changes

* Updated plugin ui to use reported `online` status for the 'Cloud Status' instead of the reported `controllable` status

## 2.14.1 (2021-03-21)

### Changes

* Fixes an issue with online/offline status as certain devices seem to report status as a boolean (not as a string)

## 2.14.0 (2021-03-21)

### Added

* Device online/offline status logging to make it clearer if a device is connected to wifi

### Changes

* **Light devices** will now send on/off commands **after** brightness and colour ([#56](https://github.com/bwp91/homebridge-govee/issues/56))
* More welcome messages
* Updated `plugin-ui-utils` dependency

## 2.13.2 (2021-03-17)

### Changes

* Modified config schema to show titles/descriptions for non Homebridge UI users

## 2.13.1 (2021-03-14)

### Changes

* Adaptive Lighting now requires Homebridge 1.3 release

## 2.13.0 (2021-03-01)

### Added

* A `label` setting per device group which has no effect except to help identify the device when editing the configuration
* Show a red/green icon in the Homebridge plugin-ui to show device reachability
* Plugin will automatically retry HTTP connection on startup in the event of certain error codes
* **In Development**
  * A configuration option to expose four non-working scenes per light device
  * The idea of this is to experiment with how scenes could work if Govee enable this functionality through the API
  * The scene buttons that appear have **no** effect except logging what should happen

### Changes

* Less strict threshold for determining a 'significant' colour change for disabling Adaptive Lighting
* Show a more user friendly log message on timeout error from Govee
* 502 and timeout errors will be hidden from the log if one has already been received during the previous minute
* Updated minimum Node to v14.16.0

## 2.12.2 (2021-02-17)

### Changes

* In debug mode, the plugin will log each device's customised options when initialised

## 2.12.1 (2021-02-17)

### Changes

* Raised minimum Homebridge beta required for Adaptive Lighting to 1.3.0-beta.58

## 2.12.0 (2021-02-13)

### Added

* A configurable minimum brightness step per Govee light bulb/strip
* The ability to explicitly enable device logging *per* device if you have `disableDeviceLogging` set to `true`

### Changes

* Show a more user friendly log message on 502 error from Govee
* Stop subsequent warning messages if a device fails to initialise
* Changes to colour conversion:
  * Lighter colours appear brighter
  * Solid red is now easier to obtain via the Home app

## 2.11.2 (2021-02-11)

### Changes

* Suitable range for `adaptiveLightingShift` added to description
* Link to 'Uninstall' wiki page in the plugin-ui
* Removed concurrency limit from http queue as throttling is based on the interval and cap
* Updated minimum Homebridge to v1.1.7
* Fakegato library formatting and simplification

## 2.11.1 (2021-02-10)

### Changes

* Fixes an issue when initialising switch devices
* Updated minimum node to v14.15.5

## 2.11.0 (2021-02-09)

### Added

* 'Light Devices' config section where you can define settings per device, starting with:
  * New `adaptiveLightingShift` option to offset the Adaptive Lighting values to make the light appear warmer
* Eve history service for Govee Wi-Fi switches

### Changes

* User inputted Govee device IDs will now be parsed more thoroughly
* Fixed a bug when trying to select a different device in the Homebridge plugin-ui

## 2.10.1 (2021-02-08)

### Changes

* Improvements to colour temperature conversion
* Fixed a bug where Adaptive Lighting would not be disabled if the colour was changed from the Govee app
* Hide the `Config entry [plugin_map] is unused and can be removed` notice for HOOBS users

## 2.10.0 (2021-02-08)

### Added

* Configuration setting `controlInterval` to change the 7500ms delay introduced in v2.9.0
  * This setting is visible in the Homebridge plugin UI screen under 'Optional Settings'
  * The default value for this setting will be 500ms but if you experience connectivity issues I would suggest increasing this number (by multiples of 500) until you find a value which works well for you

### Changes

* Brightness fix for the H6003
* Error stack will be hidden when the disabled plugin message appears in the log
* More colour conversation formula changes

## 2.9.0 (2021-02-06)

### Added

* This release hopes to bring more reliability when using HomeKit scenes and device groupings, by using:
  * A queueing system for device updates (HTTP requests) to replace the random delays
  * Delays between HTTP requests are set to 7.5 seconds which seems to work reliably
  * The refresh interval for device sync will skip whilst device updates are being sent
* Configuration checks to highlight any unnecessary or incorrectly formatted settings you have
* Link to 'Configuration' wiki page in the plugin-ui

### Changes

* ⚠️ `ignoredDevices` configuration option is now an array not a string
* If a device's current status cannot be retrieved then the log message will only be displayed in debug mode
* Colour conversation formula changes
* Error messages refactored to show the most useful information
* [Backend] Major code refactoring
* [Backend] Code comments

## 2.8.4 (2021-01-29)

### Changes

* H6109 brightness fix
* More consistent and clearer error logging
* Minor code refactors
* Updated plugin-ui-utils dep and use new method to get cached accessories

## 2.8.3 (2021-01-24)

### Changes

* H6195 brightness fix

## 2.8.2 (2021-01-24)

### Changes

* Backend - better handling of errors

## 2.8.1 (2021-01-21)

### Changes

* Minimum Homebridge beta needed for Adaptive Lighting bumped to beta-46.

## v2.8.0 (2021-01-18)

### Changes

* Plugin will log incoming device updates in `debug` mode
  * For standard usage I would recommend to have plugin `debug` mode set to OFF/FALSE, as this change will add an update to your log every X seconds depending on your refresh interval (which is 15 seconds by default)
* Brightness fix for `H7022` model

## v2.7.3 (2021-01-14)

### Changes

* Expose H5001, H5081 and H7014 as switches (not lightbulbs)
* Ensures brightness value is in [0, 100]

## 2.7.1 (2021-01-13)

### Changes

* Created CHANGELOG.md
* Brightness fix for H6188

## 2.7.0 (2021-01-12)

### New
* New configuration option `disableDeviceLogging` to stop device state changes being logged

### Changes
* Improved validation checks and formatting for user inputs
* Removal of maximum value for `number` types on plugin settings screen
* Changes to startup log messages
* Backend code changes

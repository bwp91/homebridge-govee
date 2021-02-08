# Change Log

All notable changes to this homebridge-govee will be documented in this file.

## BETA

### Added

* New `adaptiveLightingShift` option to offset the Adaptive Lighting values to make the light appear warmer

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

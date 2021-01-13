# Change Log

All notable changes to this homebridge-govee will be documented in this file.

## BETA

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

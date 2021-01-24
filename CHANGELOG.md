# Change Log

All notable changes to this homebridge-govee will be documented in this file.

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

# Change Log

All notable changes to homebridge-govee will be documented in this file.

## 4.3.0 (2021-08-05)

### Added

- **New Devices**
  - Added `H5051` to temp/humidity sensor supported list
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

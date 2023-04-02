<p align="center">
   <a href="https://github.com/bwp91/homebridge-govee"><img src="https://user-images.githubusercontent.com/43026681/101324574-5e997d80-3862-11eb-81b0-932330f6e242.png" width="600px"></a>
</p>
<span align="center">
  
# homebridge-govee

Homebridge plugin to integrate Govee devices into HomeKit

[![npm](https://img.shields.io/npm/v/homebridge-govee/latest?label=latest)](https://www.npmjs.com/package/homebridge-govee)
[![npm](https://img.shields.io/npm/v/homebridge-govee/beta?label=beta)](https://github.com/bwp91/homebridge-govee/wiki/Beta-Version)   
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![hoobs-certified](https://badgen.net/badge/HOOBS/certified/yellow?label=hoobs)](https://plugins.hoobs.org/plugin/homebridge-govee)  
[![npm](https://img.shields.io/npm/dt/homebridge-govee)](https://www.npmjs.com/package/homebridge-govee)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.com/channels/432663330281226270/742733745743855627)

</span>

### Plugin Information

- This plugin allows you to view and control your Govee devices within HomeKit. The plugin:
  - requires your Govee credentials for most device models and Cloud/BLE connections
  - can control certain models locally via LAN control without any Govee credentials
  - does **not** make use of the Govee API key

### Prerequisites

- To use this plugin, you will need to already have:
  - [Node](https://nodejs.org): latest version of v16 or v18 - any other major version is not supported.
  - [Homebridge](https://homebridge.io): v1.6 - refer to link for more information and installation instructions.
  - For bluetooth connectivity, it may be necessary to install extra packages on your system, see [Bluetooth Control](https://github.com/bwp91/homebridge-govee/wiki/Bluetooth-Control). Bluetooth works best when using a Raspberry Pi, not been tested on Windows, and Mac devices are unsupported.

### Setup

- [Installation](https://github.com/bwp91/homebridge-govee/wiki/Installation)
- [Configuration](https://github.com/bwp91/homebridge-govee/wiki/Configuration)
- [Beta Version](https://github.com/bwp91/homebridge-govee/wiki/Beta-Version)
- [Node Version](https://github.com/bwp91/homebridge-govee/wiki/Node-Version)

### Features

- [Supported Devices](https://github.com/bwp91/homebridge-govee/wiki/Supported-Devices)
- [Connection Methods](https://github.com/bwp91/homebridge-govee/wiki/Connection-Methods)
  - [LAN Control](https://github.com/bwp91/homebridge-govee/wiki/LAN-Control)
  - [AWS Control](https://github.com/bwp91/homebridge-govee/wiki/AWS-Control)
  - [BLE Control](https://github.com/bwp91/homebridge-govee/wiki/Bluetooth-Control)
- [Scene, Music, DIY Modes](https://github.com/bwp91/homebridge-govee/wiki/Scene%2C-Music%2C-DIY-Modes)

### Help/About

- [Common Errors](https://github.com/bwp91/homebridge-govee/wiki/Common-Errors)
- [Support Request](https://github.com/bwp91/homebridge-govee/issues/new/choose)
- [Changelog](https://github.com/bwp91/homebridge-govee/blob/latest/CHANGELOG.md)
- [About Me](https://github.com/sponsors/bwp91)

### Credits

- To all users who have shared their devices to enable functionality.
- To the creator/owner of the [govee-led-client](https://www.npmjs.com/package/govee-led-client) library which made the BLE connection possible.
- To the creator/owner of the [govee_api](https://github.com/towlerj/govee_api) library which made the AWS connection possible.
- To [@alboiuvlad29](https://github.com/alboiuvlad29) who made the LAN connection possible.
- To [@JeremyDunn](https://github.com/JeremyDunn) for his code from [homebridge-govee-water-detectors](https://github.com/JeremyDunn/homebridge-govee-water-detectors) for leak sensor support.
- To the creator/owner of the [govee-bt-client](https://www.npmjs.com/package/govee-bt-client) library which made the BLE connection to sensors possible.
- To the creator of the awesome plugin header logo: [Keryan Belahcene](https://www.instagram.com/keryan.me).
- To the creators/contributors of [Homebridge](https://homebridge.io) who make this plugin possible.

### Disclaimer

- I am in no way affiliated with Govee and this plugin is a personal project that I maintain in my free time.
- Use this plugin entirely at your own risk - please see licence for more information.

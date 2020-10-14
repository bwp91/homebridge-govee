<p align="center">
   <a href="https://github.com/homebridge/verified/blob/master/verified-plugins.json"><img src="https://user-images.githubusercontent.com/43026681/93664399-944e7780-fa66-11ea-8c5f-21b98d4532ce.png" width="600px"></a>
</p>
<span align="center">
  
# homebridge-govee 

 Homebridge plugin to control Govee devices that are supported by the official Govee API.
 
 [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
 [![hoobs-certified](https://badgen.net/badge/HOOBS/Certified/yellow)](https://plugins.hoobs.org/plugin/homebridge-govee)   
 [![npm](https://img.shields.io/npm/v/homebridge-govee/latest?label=latest)](https://www.npmjs.com/package/homebridge-govee)
 [![npm](https://img.shields.io/npm/v/homebridge-govee/beta?label=beta)](https://github.com/bwp91/homebridge-govee/wiki/Beta-Version)   
 [![npm](https://img.shields.io/npm/dt/homebridge-govee)](https://www.npmjs.com/package/homebridge-govee)
 [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)   
 [![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.com/channels/432663330281226270/742733745743855627)

</span>

### Homebridge
To use this plugin, you will need to already have Homebridge installed. Please refer to the [Homebridge website](https://homebridge.io) for more information and installation instructions.

### Plugin Information
This plugin uses the official Govee HTTP API to enable you to control supported Govee devices through Homebridge.

⚠️ Your devices will need have a stable connection to your Wi-Fi as this plugin uses the internet to control your devices. This plugin does **not** use a Bluetooth connection to control your devices.

⚠️ There are some light modes in which the plugin is unable to determine the current state and/or control your device. If you experience any issues then please enable "Debug Logging" from the plugin settings and useful information will be added to the Homebridge logs.

That said, in most situations this plugin allows you to control:

* On/Off state
* Brightness
* Colour

For the following Govee models:

* `H50**`
  * `H5081`
* `H60**`
  * `H6002`, `H6003`, `H6083`, `H6085`, `H6086`, `H6089` 
* `H61**`
  * `H6104`, `H6109`, `H6110`, `H6117`, `H6135`, `H6137`, `H6141`, `H6142`, `H6148`, `H6159`, `H6160`, `H6163`, `H6182`, `H6188`, `H6195`, `H6196`
* `H70**`
  * `H7005`, `H7014`, `H7021`, `H7022` 

You will need to retrieve an API key which you can obtain through the Govee mobile app.
* Go to your account tab → "About us" → "Apply for API key"
* Fill out your name and your reason - I'm sure "Control through Homebridge" would be sufficient
* You'll receive your API key to your Govee registered email address within minutes

The plugin is limited to the current functionality of the Govee API. I will continue to implement new features to the plugin as the Govee API is updated.

### Setup
* [Installation (Homebridge)](https://github.com/bwp91/homebridge-govee/wiki/Installation-(Homebridge))
* [Installation (HOOBS)](https://github.com/bwp91/homebridge-govee/wiki/Installation-(HOOBS))
* [Beta Version](https://github.com/bwp91/homebridge-govee/wiki/Beta-Version)

### About
* [About Me](https://github.com/sponsors/bwp91)
* [Support Request](https://github.com/bwp91/homebridge-govee/issues/new/choose)

### Disclaimer
I am in no way affiliated with Govee and this plugin is a personal project that I maintain in my free time.

Electron Forge Plugin Webpack
-----------------------------

A plugin for Electron Forge that brings first class `webpack`
support to your build pipeline.

> Please note this is in **beta**, if any webpack options don't work
for some reason please raise an issue (or even better a PR).

# Usage

```bash
npm i @electron-forge/plugin-webpack --save-dev
```


```js
// forge.config.js
const { WebpackPlugin } = require('@electron-forge/plugin-webpack')

module.exports = {
  // other config here
  plugins: [new WebpackPlugin(pluginConfig)]
}
```

## Project Setup

In order for this plugin to work correctly you need to have a few things
in place

1. The `main` field of your `package.json` needs to point to `".webpack/main"`
1. Correctly configured `BrowserWindow`'s, see the [Renderer Setup](#renderer-steup) section

Once your project is setup and the plugin added to your configuration, everything should
Just Work(tm).

## Plugin Configuration

```js
new WebpackPlugin({
  mainConfig: {
    // webpack config for main process
  },
  renderer: {
    config: {
      // webpack configuration for renderer processes
    },
    // Array of items to be prefixed to the "entry" array in the
    // renderer webpack config.  Useful for things like
    // 'react-hot-loader/patch'
    prefixedEntries: [],
    // Array of entry points to your application, each BrowserWindow
    // should require one entry point to be configured
    entryPoints: [{
      // Absolute path to the HTML template for this window
      html: '',
      // Absolute path to the JS entry point for this window
      js: '',
      // Name of this entry point, will be used when calling win.loadUrl
      name: ''
    }]
  }
})
```

By default the minimum possible config is defaulted inside the plugin,
this means if you are just using vanilla JS everything should work out
of the box with just a single `entryPoint` defined.

## Renderer Setup

In order to know where to load your renderer process from you should
use the magic globals that this plugin defines in your main process.

```js
win.loadURL(MY_ENTRY_POINT_NAME_WEBPACK_ENTRY);
```

Notice no quotes are required, the format is `{entryNameInUpperCase}_WEBPACK_ENTRY`

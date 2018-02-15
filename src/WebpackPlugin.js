import fs from 'fs-extra';
import merge from 'webpack-merge';
import path from 'path';
import { spawnPromise } from 'spawn-rx';
import webpack from 'webpack';
import webpackHotMiddleware from 'webpack-hot-middleware';
import webpackDevMiddleware from 'webpack-dev-middleware';
import express from 'express';

import HtmlWebpackPlugin from 'html-webpack-plugin';

const BASE_PORT = 3000;

export class WebpackPlugin {
  constructor({ mainConfig, renderer } = {}) {
    this._mainConfig = mainConfig;
    this._renderer = renderer;
    this.name = 'webpack';

    this.startLogic = this.spinDev.bind(this);
    this.getHook = this.getHook.bind(this);
    this.getMainConfig = this.getMainConfig.bind(this);
    this.getRendererConfig = this.getRendererConfig.bind(this);
    this.compileMain = this.compileMain.bind(this);
    this.compileRenderers = this.compileRenderers.bind(this);
    this.launchDevServers = this.launchDevServers.bind(this);
    this.isProd = false;
  }

  init(dir, forgeConfig, asyncOra) {
    this.dir = dir;
    this.asyncOra = asyncOra;
    this.baseDir = path.resolve(dir, '.webpack');
  }

  getHook(name) {
    switch (name) {
      case 'prePackage':
        this.isProd = true;
        return async () => {
          await this.compileMain();
          await this.compileRenderers();
        };
    }
  }

  async getMainConfig() {
    if (!this._mainConfig.entry) {
      throw new Error('Required config option "entry" has not been defined');
    }
    const defines = {};
    let index = 0;
    for (const entryPoint of this._renderer.entryPoints) {
      defines[`${entryPoint.name.toUpperCase().replace(/ /g, '_')}_WEBPACK_ENTRY`] =
        this.isProd
        ? `\`file://\$\{require('path').resolve(__dirname, '../renderer', '${entryPoint.name}', 'index.html')\}\``
        : `'http://localhost:${BASE_PORT + index}'`;
      index++;
    }
    return merge.smart({
      devtool: 'source-map',
      target: 'electron-main',
      output: {
        path: path.resolve(this.baseDir, 'main'),
        filename: 'index.js',
        libraryTarget: 'commonjs2',
      },
      plugins: [
        new webpack.DefinePlugin(defines)
      ],
      node: {
        __dirname: false,
        __filename: false
      },
    }, this._mainConfig || {});
  }

  async getRendererConfig(entryPoint) {
    const rendererConfig = this._renderer.config;
    const prefixedEntries = this._renderer.prefixedEntries || [];
    return merge.smart({
      devtool: 'inline-source-map',
      target: 'electron-renderer',
      entry: prefixedEntries.concat([
        entryPoint.js,
      ]).concat(this.isProd ? [] : ['webpack-hot-middleware/client']),
      output: {
        path: path.resolve(this.baseDir, 'renderer', entryPoint.name),
        filename: 'index.js',
      },
      node: {
        __dirname: false,
        __filename: false
      },
      plugins: [
        new HtmlWebpackPlugin({
          title: entryPoint.name,
          template: entryPoint.html,
        })
      ].concat(this.isProd ? [] : [new webpack.HotModuleReplacementPlugin()]),
    }, rendererConfig);
  }

  async compileMain() {
    await this.asyncOra('Compiling Main Process Code', async () => {
      await new Promise(async (resolve, reject) => {
        webpack(await this.getMainConfig()).run((err, stats) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  async compileRenderers() {
    for (const entryPoint of this._renderer.entryPoints) {
      await this.asyncOra(`Compiling Renderer Template: ${entryPoint.name}`, async () => {
        await new Promise(async (resolve, reject) => {
          webpack(await this.getRendererConfig(entryPoint)).run((err, stats) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    }
  }

  async launchDevServers() {
    await this.asyncOra('Launch Dev Servers', async () => {
      let index = 0;
      for (const entryPoint of this._renderer.entryPoints) {
        const config = await this.getRendererConfig(entryPoint);
        const compiler = webpack(config);
        const server = webpackDevMiddleware(compiler, {
          logLevel: 'silent',
          publicPath: '/',
          hot: true,
          historyApiFallback: true,
        });
        const app = express();
        app.use(server);
        app.use(webpackHotMiddleware(compiler))
        app.listen(BASE_PORT + index);
        index++;
      }
    });
  }

  async spinDev() {
    await this.compileMain();
    await this.launchDevServers();
    return false;
  }
}
const path = require("path");
const { merge } = require('webpack-merge');
const webpackBaseConfig = require("./configs/webpack.base.cjs");

const config = [merge(webpackBaseConfig,{
  output: {
    filename: 'node-fame.js',
    path: path.resolve(__dirname, 'dist'),
    chunkFormat: 'module',
  },
}),
  merge(webpackBaseConfig,{
  output: {
    filename: 'node-fame.cjs',
    path: path.resolve(__dirname, 'dist'),
    chunkFormat: 'commonjs',
  },
})];

module.exports = config;

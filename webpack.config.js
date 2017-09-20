const path = require('path');
const webpack = require('webpack');
module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    app: './voogpagination.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'voogpagination.min.js',
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js?$/,
        use: 'eslint',
      },
    ],
  },
  resolve: {
    modules: [
      'node_modules',
      'bower_components',
    ],
    enforceExtension: false,
  },
  resolveLoader: {
    moduleExtensions: ['-loader'],
  },
  plugins: [
    new webpack.LoaderOptionsPlugin({
      test: /\.js$/,
      options: {
        eslint: { failOnWarning: false, failOnError: true },
      },
    }),
  ],

};
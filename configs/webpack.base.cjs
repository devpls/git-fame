const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');
module.exports = {
  target: 'node',
  entry: './src/main.ts',
  mode: "development",
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
              },
            },
          },
        },
      },
    ],
  },
  resolve: {
    plugins: [new TsconfigPathsPlugin()],
    extensions: ['.tsx', '.ts', '.js', '.css'],
  },
  externalsPresets: { node: true },
};


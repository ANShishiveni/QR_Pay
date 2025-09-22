const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Add fallbacks for Node.js modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    path: require.resolve('path-browserify'),
    fs: false,
    os: require.resolve('os-browserify/browser'),
    url: require.resolve('url/'),
    zlib: require.resolve('browserify-zlib'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    assert: require.resolve('assert/'),
    constants: require.resolve('constants-browserify'),
    querystring: require.resolve('querystring-es3'),
    buffer: require.resolve('buffer/'),
  };

  // Add plugins to handle vector icons and other modules
  config.plugins.push(
    new webpack.IgnorePlugin({
      resourceRegExp: /^@react-native-vector-icons\/get-image$/,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^react-native-vector-icons\/MaterialCommunityIcons$/,
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'),
    })
  );



  // Add rule for asset handling
  config.module.rules.push({
    test: /\.(png|jpe?g|gif|svg|ico)$/i,
    type: 'asset/resource',
    generator: {
      filename: 'assets/[name][ext]',
    },
  });

  // Configure stats to show warnings
  config.stats = {
    errorDetails: true,
    warnings: true,
    colors: true,
  };

  return config;
};

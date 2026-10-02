const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
};

config.resolver.unstable_conditionNames = ['browser', 'react-native', 'import', 'require'];

// Force 'jose' to resolve to its browser WebCrypto build
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/jose/dist/browser/index.js'),
      type: 'sourceFile',
    };
  }
  if (platform !== 'web') {
    if (moduleName === '@privy-io/react-auth' || moduleName === '@privy-io/react-auth/solana') {
      return {
        filePath: path.resolve(__dirname, 'src/auth/privyAdapter.native.tsx'),
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

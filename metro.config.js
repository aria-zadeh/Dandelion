const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Transform import.meta.env references for web compatibility
// (zustand v5 uses import.meta.env which fails in Metro's non-module output)
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  unstable_conditionNames: ["browser", "require", "react-native"],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});

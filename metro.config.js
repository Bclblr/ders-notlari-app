const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// whisper.rn model files are binary assets, not JavaScript modules.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "bin", "mil"])];

module.exports = config;

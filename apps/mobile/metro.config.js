// La config de Metro de Expo, con los debug IDs que Sentry usa para cruzar los errores con los
// source maps de cada build.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);

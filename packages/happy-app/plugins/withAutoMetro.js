const { withDangerousMod } = require('@expo/config-plugins');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Detects the local network IP address of the build machine.
 */
function getLocalIP() {
  try {
    const result = execSync("ipconfig getifaddr en0 2>/dev/null || ifconfig en0 2>/dev/null | grep 'inet ' | awk '{print $2}'", { encoding: 'utf8' }).trim();
    if (result) return result;
  } catch {}
  try {
    const result = execSync("hostname -I 2>/dev/null | awk '{print $1}'", { encoding: 'utf8' }).trim();
    if (result) return result;
  } catch {}
  return 'localhost';
}

/**
 * Config plugin that injects the build machine's IP into AppDelegate.swift
 * so the Expo dev client auto-connects to Metro without showing the launcher.
 */
const withAutoMetro = (config) => {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const ip = getLocalIP();
      const appDelegatePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Happydev',
        'AppDelegate.swift'
      );

      if (fs.existsSync(appDelegatePath)) {
        let contents = fs.readFileSync(appDelegatePath, 'utf8');

        // Inject jsLocation before the jsBundleURL call
        const target = 'return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")';
        const replacement = `RCTBundleURLProvider.sharedSettings().jsLocation = "${ip}"\n    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")`;

        if (contents.includes(target) && !contents.includes('jsLocation')) {
          contents = contents.replace(target, replacement);
          fs.writeFileSync(appDelegatePath, contents, 'utf8');
          console.log(`✅ Auto Metro: injected jsLocation = "${ip}"`);
        } else if (contents.includes('jsLocation')) {
          // Update existing IP
          contents = contents.replace(
            /jsLocation = "[^"]*"/,
            `jsLocation = "${ip}"`
          );
          fs.writeFileSync(appDelegatePath, contents, 'utf8');
          console.log(`✅ Auto Metro: updated jsLocation = "${ip}"`);
        } else {
          console.warn('⚠️ Auto Metro: could not find injection point in AppDelegate.swift');
        }
      }

      return modConfig;
    },
  ]);
};

module.exports = withAutoMetro;

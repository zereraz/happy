#!/bin/bash
set -e

DEVICE_UUID="5A414E50-EE40-5649-BE9F-100E3B96DDB6"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$APP_DIR/ios"
DERIVED_DATA="$IOS_DIR/build/DerivedData"
BUILD_DIR="$DERIVED_DATA/Build/Products/Release-iphoneos"

echo "==> Building Happy (dev) Release for device..."
xcodebuild \
  -workspace "$IOS_DIR/Happydev.xcworkspace" \
  -scheme Happydev \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$DERIVED_DATA" \
  -destination "generic/platform=iOS" \
  DEVELOPMENT_TEAM=CN34588N4Y \
  CODE_SIGN_STYLE=Automatic \
  RCT_NO_LAUNCH_PACKAGER=1 \
  -allowProvisioningUpdates \
  build 2>&1 | tee "${TMPDIR:-/tmp}/happy-xcodebuild.log" | tail -5

# Check if build succeeded
if ! /usr/bin/grep -q "BUILD SUCCEEDED" "${TMPDIR:-/tmp}/happy-xcodebuild.log"; then
  echo "ERROR: xcodebuild failed. Last 30 lines:"
  tail -30 "${TMPDIR:-/tmp}/happy-xcodebuild.log"
  exit 1
fi

# Install on iPhone over WiFi
echo ""
echo "==> Installing on iPhone..."
xcrun devicectl device install app --device "$DEVICE_UUID" "$BUILD_DIR/Happydev.app"

echo ""
echo "==> Done! Happy (dev) installed on iPhone."

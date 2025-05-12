#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# init-expo.sh
#
# Bootstrap an Expo‑managed React Native app with:
#  • TypeScript template
#  • .env management (git‑ignored)
#  • Android keystore generation & injection
#  • iOS prebuild (optional)
#  • EAS build profiles
###############################################################################

APP_NAME="SwampRabbitApp"
TEMPLATE="expo-template-blank-typescript"
ENV_FILE=".env"
KEYSTORE_DIR="android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/release.keystore"
KEY_ALIAS="swamprabbit"
# generate strong random secrets
ENCRYPTION_SECRET=$(openssl rand -hex 32)
TINYLLAMA_SHA256=$(openssl rand -hex 32)
KEYSTORE_PASSWORD=$(openssl rand -hex 16)
KEY_PASSWORD=$(openssl rand -hex 16)

echo "==> 1. Create Expo project"
npx expo init "$APP_NAME" --template "$TEMPLATE"
cd "$APP_NAME"

echo
echo "==> 2. Git‑ignore environment file"
grep -qxF "$ENV_FILE" .gitignore || echo "$ENV_FILE" >> .gitignore

echo
echo "==> 3. Install dependencies"
yarn add \
  @react-native-async-storage/async-storage \
  react-native-encrypted-storage \
  react-native-sqlite-storage \
  react-native-linear-gradient \
  @react-native-community/slider \
  react-native-markdown-display \
  react-native-vector-icons \
  react-native-image-picker \
  @react-native-clipboard/clipboard \
  react-native-config \
  react-native-fs \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  react-native-device-info \
  tinyllama-react-native \
  axios \
  crypto-js

echo
echo "==> 4. Expo prebuild (generates native projects)"
npx expo prebuild --no-install

echo
echo "==> 5. Write .env with secure values"
cat > "$ENV_FILE" <<EOF
ENCRYPTION_SECRET=$ENCRYPTION_SECRET
TINYLLAMA_SHA256=$TINYLLAMA_SHA256
EOF

echo
echo "==> 6. Generate Android keystore"
mkdir -p "$KEYSTORE_DIR"
keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "CN=SwampRabbit, OU=Dev, O=Booper, L=Greenville, S=SC, C=US"

echo
echo "==> 7. Configure Android buildCredentials.json"
cat > android/credentials.json <<EOF
{
  "android": {
    "keystore": {
      "keystorePath": "$KEYSTORE_FILE",
      "keystorePassword": "$KEYSTORE_PASSWORD",
      "keyAlias": "$KEY_ALIAS",
      "keyPassword": "$KEY_PASSWORD"
    }
  }
}
EOF

echo
echo "==> 8. EAS Build profile setup"
# Create eas.json if missing
if [ ! -f eas.json ]; then
  cat > eas.json <<EAS
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk",
        "releaseChannel": "production"
      },
      "ios": {
        "releaseChannel": "production"
      }
    }
  }
}
EAS
fi

echo
echo "==> 9. Install iOS pods"
pushd ios >/dev/null
pod install
popd >/dev/null

echo
echo "==> 10. (Optional) Run a local build"
echo "    To build Android locally:"
echo "      eas build -p android --profile production"
echo
echo "    To build iOS locally (macOS):"
echo "      eas build -p ios --profile production"

echo
echo "==> 11. Cleanup sensitive .env"
rm -f "$ENV_FILE"

echo
echo "==> Bootstrap complete! 🎉"
echo "    • App directory: $(pwd)"
echo "    • Android keystore: $KEYSTORE_FILE"
echo "    • EAS build profiles in eas.json"

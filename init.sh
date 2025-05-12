#!/usr/bin/env bash
# setup_rn_project.sh  – one-time bootstrap for Swamp Rabbit Oracle
# Run from repo root. Re-running is safe (no duplicate work).

set -euo pipefail

###############################################################################
# Config (edit if you like)
###############################################################################
APP_NAME="SwampRabbitApp"         # only used for key alias / DN
ANDROID_DIR="./android"           # where the native project lives
TEMP_NATIVE="TempNativeRN"        # tmp folder for react-native init

KEYSTORE_DIR="$ANDROID_DIR/app"
KEYSTORE_FILE="$KEYSTORE_DIR/my-release-key.jks"
KEY_ALIAS="$APP_NAME"

###############################################################################
# 0. Prerequisites quick-check
###############################################################################
command -v npx >/dev/null      || { echo "❌ npx not found – install Node.js"; exit 1; }
command -v yarn >/dev/null     || { echo "❌ yarn not found – run npm i -g yarn"; exit 1; }
command -v keytool >/dev/null  || { echo "❌ keytool (from JDK) not found – install JDK"; exit 1; }

###############################################################################
# 1. Scaffold android/ if missing
###############################################################################
if [ ! -d "$ANDROID_DIR" ]; then
  echo "==> android/ not found – generating via react-native init (typescript)…"
  npx react-native@latest init "$TEMP_NATIVE" \
      --template react-native-template-typescript \
      --skip-install --skip-git-init

  mv "$TEMP_NATIVE/android" "$ANDROID_DIR"
  rm -rf "$TEMP_NATIVE"
  echo "==> android/ project scaffolding complete."
else
  echo "==> android/ already present – skipping scaffold."
fi

###############################################################################
# 2. Ensure Gradle wrapper is executable
###############################################################################
chmod +x "$ANDROID_DIR/gradlew"

###############################################################################
# 3. Generate keystore (dev placeholder) if absent
###############################################################################
if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "==> Generating self-signed release keystore (dev placeholder)…"
  mkdir -p "$KEYSTORE_DIR"
  keytool -genkeypair -v \
      -keystore "$KEYSTORE_FILE" \
      -storepass changeit -keypass changeit \
      -alias "$KEY_ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=$APP_NAME, OU=Dev, O=SwampRabbit, L=Greenville, S=SC, C=US"
else
  echo "==> Keystore already exists – skipping generation."
fi

###############################################################################
# 4. Append signing placeholders to gradle.properties (idempotent)
###############################################################################
if ! grep -q "MYAPP_UPLOAD_STORE_FILE" "$ANDROID_DIR/gradle.properties"; then
cat <<EOF >> "$ANDROID_DIR/gradle.properties"

### --- CI signing placeholders (overridden by GitHub Actions) ---
MYAPP_UPLOAD_STORE_FILE=$(basename "$KEYSTORE_FILE")
MYAPP_UPLOAD_KEY_ALIAS=$KEY_ALIAS
MYAPP_UPLOAD_STORE_PASSWORD=changeme
MYAPP_UPLOAD_KEY_PASSWORD=changeme
### --------------------------------------------------------------
EOF
  echo "==> Added signing placeholders to gradle.properties."
else
  echo "==> Signing placeholders already present – skipping."
fi

###############################################################################
# 5. JS dependencies
###############################################################################
echo "==> Installing JS dependencies (yarn)…"
yarn install --frozen-lockfile

###############################################################################
# 6. Optional local build (comment out if you only build in CI)
###############################################################################
echo "==> Building debug APK locally to verify setup…"
( cd "$ANDROID_DIR" && ./gradlew assembleDebug )

###############################################################################
# 7. Output keystore in base-64 (copy into repo secret KEYSTORE_BASE64)
###############################################################################
echo
echo "==> Base-64 keystore (copy entire line into GitHub secret KEYSTORE_BASE64):"
base64 -w0 "$KEYSTORE_FILE"
echo
echo "==> Setup complete – commit the android/ folder and push."

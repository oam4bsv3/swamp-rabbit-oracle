#!/bin/bash

set -e

APP_NAME="SwampRabbitApp"
KEYSTORE_DIR="android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/release.keystore"
ENV_FILE=".env"

KEY_ALIAS="swamprabbit"
KEY_PASSWORD=$(openssl rand -hex 16)
KEYSTORE_PASSWORD=$(openssl rand -hex 16)
AES_KEY=$(openssl rand -hex 32)
TINY_HASH=$(openssl rand -hex 32)

echo "==> Initializing app"
npx react-native init $APP_NAME --template react-native-template-typescript
cd $APP_NAME

echo "==> Ensuring .env is git-ignored"
echo ".env" >> .gitignore

echo "==> Installing dependencies"
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
  @pennylane/wasm \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  @react-native-community/progress-bar-android \
  react-native-device-info \
  tinyllama-react-native \
  axios \
  crypto-js

echo "==> Installing iOS pods"
cd ios && pod install && cd ..

echo "==> Writing .env with secure values"
echo "ENCRYPTION_SECRET=$AES_KEY" > $ENV_FILE
echo "TINYLLAMA_SHA256=$TINY_HASH" >> $ENV_FILE

echo "==> Generating Android keystore"
mkdir -p $KEYSTORE_DIR
keytool -genkeypair -v -keystore $KEYSTORE_FILE \
  -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass $KEYSTORE_PASSWORD -keypass $KEY_PASSWORD \
  -dname "CN=SwampRabbit, OU=Dev, O=Booper, L=Greenville, S=SC, C=US"

echo "==> Writing Gradle properties"
cat <<EOF >> android/gradle.properties
MYAPP_UPLOAD_STORE_FILE=release.keystore
MYAPP_UPLOAD_KEY_ALIAS=$KEY_ALIAS
MYAPP_UPLOAD_STORE_PASSWORD=$KEYSTORE_PASSWORD
MYAPP_UPLOAD_KEY_PASSWORD=$KEY_PASSWORD
EOF

echo "==> Injecting signingConfigs into build.gradle"
sed -i '/defaultConfig {/a \
    signingConfigs {\n\
        release {\n\
            storeFile file(MYAPP_UPLOAD_STORE_FILE)\n\
            storePassword MYAPP_UPLOAD_STORE_PASSWORD\n\
            keyAlias MYAPP_UPLOAD_KEY_ALIAS\n\
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD\n\
        }\n\
    }' android/app/build.gradle

sed -i '/buildTypes {/a \
    release {\n\
        signingConfig signingConfigs.release\n\
        shrinkResources false\n\
        minifyEnabled false\n\
    }' android/app/build.gradle

echo "==> Building Android release APK"
cd android && ./gradlew assembleRelease && cd ..

echo "==> Cleaning up .env to avoid accidental commit"
rm -f .env

echo "==> Done."
echo "Release APK located at: android/app/build/outputs/apk/release/app-release.apk"

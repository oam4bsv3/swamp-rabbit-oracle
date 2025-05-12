#!/bin/bash

set -e

APP_NAME="SwampRabbitApp"
KEYSTORE_FILE="android/app/release.keystore"
ENV_FILE=".env"

echo "==> Setting up project"
npx react-native init $APP_NAME --template react-native-template-typescript
cd $APP_NAME

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

echo "==> Creating .env file with AES key and model hash"
echo "TINYLLAMA_SHA256=$(openssl rand -hex 32)" > $ENV_FILE
echo "ENCRYPTION_SECRET=$(openssl rand -hex 32)" >> $ENV_FILE

# Inject into iOS
echo "==> Injecting ENV into iOS"
cd ios
echo "export $(cat ../.env | xargs)" > tmpenv.sh
source tmpenv.sh
cd ..

# Inject into Android build
echo "==> Creating Android keystore from GitHub Secrets"
# These must be stored as GitHub secrets
echo "${ANDROID_KEYSTORE_BASE64}" | base64 --decode > $KEYSTORE_FILE

# Inject key info
cat <<EOF >> android/gradle.properties
MYAPP_UPLOAD_STORE_FILE=release.keystore
MYAPP_UPLOAD_KEY_ALIAS=${ANDROID_KEY_ALIAS}
MYAPP_UPLOAD_STORE_PASSWORD=${ANDROID_KEYSTORE_PASSWORD}
MYAPP_UPLOAD_KEY_PASSWORD=${ANDROID_KEY_PASSWORD}
EOF

echo "==> Configuring Gradle signing"
cat <<EOF >> android/app/build.gradle

android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            shrinkResources false
            minifyEnabled false
        }
    }
}
EOF

echo "==> Building Android APK"
cd android && ./gradlew assembleRelease && cd ..

echo "==> Building iOS Release (manual codesign)"
xcodebuild -workspace ios/$APP_NAME.xcworkspace \
           -scheme $APP_NAME \
           -configuration Release \
           -sdk iphoneos \
           -archivePath ios/build/$APP_NAME.xcarchive \
           archive

xcodebuild -exportArchive \
           -archivePath ios/build/$APP_NAME.xcarchive \
           -exportOptionsPlist ios/exportOptions.plist \
           -exportPath ios/build

echo "==> Build complete. Android APK is at:"
echo "./android/app/build/outputs/apk/release/app-release.apk"

echo "==> iOS IPA is inside:"
echo "./ios/build/"

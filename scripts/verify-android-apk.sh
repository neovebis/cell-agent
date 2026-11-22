#!/usr/bin/env bash
set -euo pipefail
APK='android/app/build/outputs/apk/release/app-release.apk'
test -s "$APK"
TOOLS=$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)
mkdir -p build-output
"$TOOLS/zipalign" -c -P 16 4 "$APK"
"$TOOLS/apksigner" verify --verbose --print-certs "$APK" | tee build-output/signature.txt
keytool -exportcert -keystore android/app/release.keystore -alias "$KEY_ALIAS" -storepass:env STORE_PASS -file "$RUNNER_TEMP/expected-certificate.der"
EXPECTED=$(sha256sum "$RUNNER_TEMP/expected-certificate.der" | cut -d ' ' -f 1)
ACTUAL=$(node scripts/read-apk-certificate.cjs build-output/signature.txt)
test "$EXPECTED" = "$ACTUAL"
"$TOOLS/aapt2" dump badging "$APK" > build-output/manifest.txt
grep -F "name='com.cellsystem.agent.mobile'" build-output/manifest.txt
grep -F "versionCode='$APP_VERSION_CODE'" build-output/manifest.txt
grep -F "versionName='$APP_VERSION'" build-output/manifest.txt
if grep -q 'application-debuggable' build-output/manifest.txt; then echo 'Unexpected debuggable APK'; exit 1; fi
gh release download v0.2.2 --repo neovebis/cell-agent --pattern '*.apk' --dir "$RUNNER_TEMP/baseline"
"$TOOLS/apksigner" verify --verbose --print-certs "$RUNNER_TEMP/baseline/cell-agent-mobile-v0.2.2.apk" > build-output/baseline-signature.txt
BASELINE=$(node scripts/read-apk-certificate.cjs build-output/baseline-signature.txt)
UPGRADE=false
if [ "$BASELINE" = "$ACTUAL" ]; then UPGRADE=true; fi
jq -n --arg version "$APP_VERSION" --argjson versionCode "$APP_VERSION_CODE" --arg commit "${APK_SOURCE_COMMIT:-$GITHUB_SHA}" --arg verificationCommit "$GITHUB_SHA" --arg certificateSHA256 "$ACTUAL" --argjson canUpdateV022 "$UPGRADE" '{version:$version,versionCode:$versionCode,commit:$commit,verificationCommit:$verificationCommit,certificateSHA256:$certificateSHA256,canUpdateV022:$canUpdateV022}' > build-output/build-info.json
cp "$APK" "build-output/cell-agent-mobile-v$APP_VERSION.apk"
(cd build-output && sha256sum "cell-agent-mobile-v$APP_VERSION.apk" > "cell-agent-mobile-v$APP_VERSION.apk.sha256")
cat build-output/build-info.json

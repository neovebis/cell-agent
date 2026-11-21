#!/usr/bin/env bash
set -euo pipefail

# This script is deliberately limited to a disposable CI emulator.
test "${CI:-}" = true
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
[[ "$ANDROID_SERIAL" == emulator-* ]]
test "$(adb shell getprop ro.kernel.qemu | tr -d '\r')" = 1

PACKAGE=com.cellsystem.agent.mobile
OUT=build/installation-evidence
mkdir -p "$OUT"
collect() {
  adb logcat -b all -d > "$OUT/logcat.txt" 2>&1 || true
  adb logcat -b crash -d > "$OUT/crashes.txt" 2>&1 || true
  adb shell dumpsys package "$PACKAGE" > "$OUT/package.txt" 2>&1 || true
  adb exec-out screencap -p > "$OUT/final.png" 2>/dev/null || true
}
trap collect EXIT

mapfile -t candidates < <(find build-output -maxdepth 1 -type f -name '*.apk')
mapfile -t baselines < <(find build-install/baseline -maxdepth 1 -type f -name '*.apk')
test "${#candidates[@]}" = 1
test "${#baselines[@]}" = 1
APK="${candidates[0]}"
BASELINE="${baselines[0]}"

# Keep the app offline: installation/launch tests never use a real account.
adb shell svc wifi disable
adb shell svc data disable
adb shell getprop ro.build.version.sdk | tee "$OUT/api-level.txt"
adb shell getprop ro.product.cpu.abilist | tee "$OUT/abis.txt"
adb logcat -c

launch() {
  local stage="$1"
  adb shell am force-stop "$PACKAGE"
  adb shell am start -W -n "$PACKAGE/.MainActivity" | tee "$OUT/$stage-launch.txt"
  grep -q 'Status: ok' "$OUT/$stage-launch.txt"
  for attempt in $(seq 1 10); do
    sleep 1
    adb shell pidof "$PACKAGE" >/dev/null
  done
  adb shell uiautomator dump --compressed /sdcard/cell-agent-install.xml
  adb pull /sdcard/cell-agent-install.xml "$OUT/$stage-ui.xml"
  grep -q 'Entrar' "$OUT/$stage-ui.xml"
  adb exec-out screencap -p > "$OUT/$stage.png"
}

# No -t, -d or other flags that could hide a production installation defect.
adb install --no-incremental "$APK" | tee "$OUT/fresh-install.txt"
launch fresh

# Only the disposable emulator's test app is removed.
adb uninstall "$PACKAGE"
adb install --no-incremental "$BASELINE" | tee "$OUT/baseline-install.txt"
adb shell dumpsys package "$PACKAGE" > "$OUT/baseline-package.txt"
before_uid=$(sed -n 's/.*userId=\([0-9]*\).*/\1/p' "$OUT/baseline-package.txt" | head -n 1)
test -n "$before_uid"
adb install --no-incremental -r "$APK" | tee "$OUT/update-install.txt"
adb shell dumpsys package "$PACKAGE" > "$OUT/updated-package.txt"
after_uid=$(sed -n 's/.*userId=\([0-9]*\).*/\1/p' "$OUT/updated-package.txt" | head -n 1)
test "$before_uid" = "$after_uid"
launch updated
printf 'Fresh installation and update passed; package UID preserved.\n' | tee "$OUT/result.txt"

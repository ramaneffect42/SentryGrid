# Disaster Mesh Communication App

Android-first React Native starter for offline, peer-to-peer disaster communication. This repo contains the app architecture, storage layer, navigation, permissions flow, and transport-agnostic mesh scaffolding needed for Phase 1 and the start of Phase 2.

## Verified versions

- React Native `0.81.1`
- React Navigation `7.x`
- `react-native-quick-sqlite` `8.2.7`

`react-native-quick-sqlite` is currently marked deprecated on npm in favor of `react-native-nitro-sqlite`, but this starter keeps it because you explicitly requested it. The storage interface is isolated so you can swap implementations later with minimal refactoring.

## 1. Create the app shell

If you are starting from a completely empty folder, create the native scaffold first:

```powershell
npx @react-native-community/cli@latest init DisasterMeshApp --version 0.81.1
cd DisasterMeshApp
```

If you are using this repo as the app root, generate the native scaffold into this folder before the first build, then keep the `src/` and `App.js` files from this starter.

## 2. Install dependencies

```powershell
npm install
```

If you bootstrap from a plain React Native CLI project and only want to add the app dependencies manually:

```powershell
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-quick-sqlite
```

## 3. Android permissions

Add these permissions to `android/app/src/main/AndroidManifest.xml` inside the `<manifest>` element:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
```

Inside the `<application>` tag, keep your default app settings and add any BLE service declarations later when native transport code is introduced.

## 4. Gradle notes

For `react-native-quick-sqlite`, you can define SQLite compile flags in `android/gradle.properties` if needed:

```properties
quickSqliteFlags=SQLITE_ENABLE_FTS5=1
```

You do not need custom Gradle changes for this starter beyond the normal React Native CLI scaffold.

## 5. Run on Android

Start Metro:

```powershell
npm start
```

In another terminal, build and run:

```powershell
npm run android
```

Useful device commands:

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
adb logcat *:S ReactNative:V ReactNativeJS:V
```

## 6. Debugging checklist

### Metro issues

- Clear cache: `npx react-native start --reset-cache`
- Ensure port 8081 is free
- Re-run `adb reverse tcp:8081 tcp:8081` for physical devices

### ADB issues

- Verify device visibility: `adb devices`
- Restart server: `adb kill-server` then `adb start-server`
- Re-enable USB debugging if the device shows as unauthorized

### Build failures

- Clean Gradle: `cd android && .\gradlew clean`
- Confirm `ANDROID_HOME` and platform tools are in `PATH`
- Open the `android/` project in Android Studio and let it sync if Gradle downloads are incomplete

## 7. Folder structure

```text
.
|-- App.js
|-- index.js
|-- package.json
`-- src
    |-- components
    |   |-- MessageBubble.js
    |   `-- ScreenContainer.js
    |-- navigation
    |   `-- AppNavigator.js
    |-- screens
    |   |-- ChatScreen.js
    |   |-- HomeScreen.js
    |   `-- NearbyDevicesScreen.js
    |-- services
    |   |-- MeshService.js
    |   |-- PermissionsService.js
    |   |-- StorageService.js
    |   |-- meshRuntime.js
    |   `-- transports
    |       |-- BLETransport.js
    |       |-- BaseTransport.js
    |       `-- WiFiDirectTransport.js
    `-- utils
        |-- constants.js
        `-- logger.js
```

## 8. Architecture notes

- `MeshService` owns discovery, peer state, deduplication, TTL handling, and relay decisions.
- `BaseTransport` defines the interface that BLE, Wi-Fi Direct, and future LoRa transports implement.
- Messages are transport-agnostic envelopes with `id`, `sender`, `type`, `payload`, `ttl`, `timestamp`, `via`, and `deviceType`.
- `StorageService` keeps `messages` and `peers` in SQLite so the app can recover after disconnections or restarts.
- Future ESP32 repeater support fits by adding `LoRaTransport` without rewriting routing logic.

## 9. Next implementation step

This starter intentionally leaves BLE and Wi-Fi Direct as scaffolds because production-grade Android transport code will require either native modules or carefully selected React Native community packages. Once you choose the BLE and Wi-Fi Direct libraries, the transport classes are the only area that should need significant native integration work.

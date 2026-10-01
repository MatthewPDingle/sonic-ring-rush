# Sonic Ring Rush for Android

Standalone, signed APK with all four courses, graphics and procedural audio
bundled offline. A native Java Activity hosts the existing Three.js game in
Android's hardware-accelerated WebView. This preserves the Windows game's
renderer and gameplay; it is not a Java/C++ rewrite of the 3D engine.

Android 9 or newer; OpenGL ES 3 and a current Android System WebView required.
No server, browser launch, account, or network is needed to play.

The Activity is resizable and handles screen size, density and orientation
changes without recreating the WebView. The race continues through a fold or
rotation; leaving the app or losing audio focus pauses it. Touch controls adapt
to narrow cover screens, wide unfolded windows and short landscape windows.
The smaller steering pad changes one lane when the thumb passes a side marker;
recenter or lift to request another change. Android renders at native device
pixel density with FXAA. Mobile lighting, character batching, cached sky and
distant-item culling reduce GPU cost while retaining the authored meshes and
textures. Full native resolution takes priority over the 120 FPS target.

Back closes sound settings, pauses a race, returns from pause/results to the
world selection, then exits from the menu. Native window insets keep controls
away from cutouts and Android's gesture bar.

## Build

The portable build dependencies live in `.android-tools/` and are not shipped
in the APK. They were downloaded from Google's Android SDK repository and
Microsoft's OpenJDK download page and checked against the publishers' hashes.
Required layout:

- `.android-tools/jdk/<jdk folder>/bin/{java,javac,keytool}.exe`
- `.android-tools/build-tools/android-16/` (Android build tools 36.0.0)
- `.android-tools/platform/android-36/android.jar` (Android 16 SDK platform)
- `.android-tools/platform-tools/adb.exe` (optional device installation)

From the project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1
```

Output: `release/Sonic-Ring-Rush-Android.apk`. A private signing key is generated
once in `android/signing/`; preserve that directory to install future updates
without uninstalling and losing saved best times. It is excluded from source
control. Build steps use the official `aapt2`, `javac`, `d8`, `zipalign` and
`apksigner` tools without installing global software.

`-DebugWebView` creates a separate test APK with the WebView inspector enabled.
The regular APK disables debugging. Both use the same local signing key.

## Install

Open the APK on the phone and allow installation from the app used to open it,
or use a paired ADB connection:

```powershell
.android-tools/platform-tools/adb.exe -s PHONE_ADDRESS install -r release/Sonic-Ring-Rush-Android.apk
.android-tools/platform-tools/adb.exe -s PHONE_ADDRESS shell am start -n com.ringrush.game/.GameActivity
```

Wireless debugging uses a pairing port/code and a separate connection port.
Those details expire and are deliberately not stored in project files.

References: [Android local content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content),
[WebView state across folding/resizing](https://developer.android.com/develop/adaptive-apps/cookbook/webview-state).

# Android native emergency layer

## File paths

| Purpose | File |
|---|---|
| Foreground service | `android/app/src/main/java/com/guardian/safety/EmergencyForegroundService.kt` |
| Capacitor plugin | `android/app/src/main/java/com/guardian/safety/EmergencyPlugin.kt` |
| Capacitor registration | `android/app/src/main/java/com/guardian/safety/MainActivity.java` |
| Boot recovery | `android/app/src/main/java/com/guardian/safety/BootReceiver.kt` |
| Permissions and components | `android/app/src/main/AndroidManifest.xml` |
| React bridge | `src/lib/nativeBridge.ts` |

The plugin is registered as `EmergencyPlugin` and the existing React bridge resolves it first. The old `SosNative` name is only kept as a runtime fallback for older installed builds.

## React usage

```ts
import { nativeBridge } from '@/lib/nativeBridge';

await nativeBridge.triggerSOS();
await nativeBridge.startGPSTracking();
await nativeBridge.stopGPSTracking();
await nativeBridge.cancelSOS();
```

For direct Capacitor access:

```ts
import { Capacitor } from '@capacitor/core';

const EmergencyPlugin = Capacitor.Plugins.EmergencyPlugin;
await EmergencyPlugin.triggerSOS({ eventId: crypto.randomUUID() });
await EmergencyPlugin.cancelSOS();
```

Before calling SOS in a new screen, request permissions once:

```ts
await EmergencyPlugin.requestEmergencyPermissions();
const status = await EmergencyPlugin.checkEmergencyPermissions();
```

## GitHub Actions signing

The workflow `.github/workflows/android-release.yml` builds both:

- `app-release.apk`
- `app-release.aab`

It runs on a version tag (`v1.0.0`) or manually through **Actions → Android Release → Run workflow**.

Create a release keystore outside the repository:

```bash
keytool -genkeypair -v \
  -keystore guardian-release.jks \
  -alias guardian \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w 0 guardian-release.jks > guardian-release.base64.txt
```

Add these GitHub repository secrets under **Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The workflow decodes the keystore only inside the temporary GitHub runner, writes `android/keystore.properties`, builds signed artifacts, uploads them, and deletes the signing files. **Do not use fixed passwords or commit a keystore to Git.**

For local signing, create the same `android/keystore.properties` file locally (it is ignored by Git):

```properties
storeFile=/absolute/path/to/guardian-release.jks
storePassword=YOUR_LOCAL_SECRET
keyAlias=guardian
keyPassword=YOUR_LOCAL_SECRET
```

Then run:

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleRelease bundleRelease
```

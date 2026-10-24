/* Adds Strong & Steady's own parts to the standard Capacitor Android project.
   Run by the GitHub build after "npx cap add android":  node tools/patch_android.js */
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, ".."), A = path.join(root, "android", "app");
const PKG = "io/github/sitereadyapp/strongsteady";
const read = p => fs.readFileSync(p, "utf8"), write = (p, s) => fs.writeFileSync(p, s);
function copyDir(src, dst) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } }

// 1. Java code
const javaDst = path.join(A, "src/main/java", PKG);
fs.mkdirSync(javaDst, { recursive: true });
for (const f of fs.readdirSync(path.join(root, "native/java"))) fs.copyFileSync(path.join(root, "native/java", f), path.join(javaDst, f));

// 2. Icons, notification icon, splash screens
const res = path.join(A, "src/main/res");
for (const f of fs.readdirSync(path.join(root, "native/res"))) {
  const s = path.join(root, "native/res", f);
  if (fs.statSync(s).isDirectory()) copyDir(s, path.join(res, f));
}
for (const d of fs.readdirSync(res)) {
  const sp = path.join(res, d, "splash.png");
  if (fs.existsSync(sp)) fs.copyFileSync(path.join(root, "native/res", d.includes("land") ? "splash-land.png" : "splash-port.png"), sp);
}

// 3. App name ("&" must be escaped in Android resources)
const strings = path.join(res, "values/strings.xml");
write(strings, read(strings)
  .replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">Strong &amp; Steady</string>')
  .replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">Strong &amp; Steady</string>'));
const colors = path.join(res, "values/colors.xml");
if (fs.existsSync(colors)) write(colors, read(colors).replace(/(name="colorPrimary">)[^<]*/, "$1#0E5A57").replace(/(name="colorPrimaryDark">)[^<]*/, "$1#0A4644"));

// 4. Manifest: permissions, reminder receiver, text-to-speech query
const man = path.join(A, "src/main/AndroidManifest.xml");
let m = read(man);
if (!m.includes("ACTIVITY_RECOGNITION")) {
  m = m.replace('<uses-permission android:name="android.permission.INTERNET" />',
`<uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-feature android:name="android.hardware.sensor.stepcounter" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    <queries>
        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>
    </queries>`);
  m = m.replace("</application>",
`    <receiver android:name=".NudgeReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
    </application>`);
  write(man, m);
}

// 5. Gradle: WorkManager, version numbers, signing (only when a key is supplied by the build)
const gr = path.join(A, "build.gradle");
let g = read(gr);
const pkg = JSON.parse(read(path.join(root, "package.json")));
const run = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10);
g = g.replace(/versionCode \d+/, "versionCode " + run).replace(/versionName "[^"]*"/, `versionName "${pkg.version}"`);
if (!g.includes("androidx.work")) g = g.replace("dependencies {", 'dependencies {\n    implementation "androidx.work:work-runtime:2.10.0"');
if (!g.includes("STEADY_KEYSTORE")) g += `
android {
    signingConfigs {
        release {
            if (System.getenv("STEADY_KEYSTORE")) {
                storeFile file(System.getenv("STEADY_KEYSTORE"))
                storePassword System.getenv("STEADY_STORE_PW")
                keyAlias System.getenv("STEADY_KEY_ALIAS")
                keyPassword System.getenv("STEADY_KEY_PW")
            }
        }
    }
    buildTypes { release { if (System.getenv("STEADY_KEYSTORE")) { signingConfig signingConfigs.release } } }
}
`;
write(gr, g);
console.log("Android project patched: version", pkg.version, "build", run);

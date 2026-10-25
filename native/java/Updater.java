package io.github.sitereadyapp.strongsteady;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Self-updating for the version installed from GitHub (not needed once the app is on Google Play).
 * Checks the repository's latest release, downloads the APK, checks it is signed with the same key as the
 * installed app, then installs it. On Android 12+ later updates can install silently (overnight);
 * otherwise the phone shows its own "Update?" prompt.
 */
public class Updater {
    static final String API = "https://api.github.com/repos/site-ready-app/Strong-Steady/releases/latest";
    static final long CHECK_EVERY = 60L * 60 * 1000;      // background: hourly
    static final long CHECK_OPEN = 10L * 60 * 1000;        // when the app is opened: if not checked in the last 10 minutes

    static SharedPreferences prefs(Context c) { return StepStore.prefs(c); }

    static long currentCode(Context c) {
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
        } catch (Exception e) { return 0; }
    }

    static String currentName(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    static boolean canInstall(Context c) {
        return Build.VERSION.SDK_INT < 26 || c.getPackageManager().canRequestPackageInstalls();
    }

    static File apkFile(Context c, long code) {
        File dir = new File(c.getFilesDir(), "update");
        dir.mkdirs();
        return new File(dir, "strong-steady-" + code + ".apk");
    }

    /** Check GitHub (at most every 6 hours unless forced) and download a newer version if there is one. Background thread only. */
    static synchronized void check(Context c, boolean force) { check(c, force ? 0 : CHECK_EVERY); }

    static synchronized void check(Context c, long minGap) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        if (now - p.getLong("updLastCheck", 0) < minGap) return;
        p.edit().putLong("updLastCheck", now).apply();
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(API).openConnection();
            con.setRequestProperty("Accept", "application/vnd.github+json");
            con.setRequestProperty("User-Agent", "StrongSteady-App");
            con.setConnectTimeout(15000); con.setReadTimeout(20000);
            if (con.getResponseCode() != 200) { p.edit().putString("updError", "GitHub said " + con.getResponseCode()).apply(); return; }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
            JSONObject rel = new JSONObject(sb.toString());
            String tag = rel.optString("tag_name", "");
            Matcher m = Pattern.compile("build(\\d+)").matcher(tag);
            if (!m.find()) return;
            long code = Long.parseLong(m.group(1));
            String url = null; JSONArray as = rel.optJSONArray("assets");
            if (as != null) for (int i = 0; i < as.length(); i++) { JSONObject a = as.getJSONObject(i); if ("strong-steady.apk".equals(a.optString("name"))) url = a.optString("browser_download_url"); }
            String name = tag.replaceFirst("^v", "").replaceFirst("-build\\d+$", "");
            p.edit().putLong("updLatest", code).putString("updLatestName", name).putString("updNotes", rel.optString("body", "")).remove("updError").apply();
            if (code <= currentCode(c) || url == null) return;
            if (p.getLong("updReady", 0) == code && apkFile(c, code).exists()) return;
            File dir = apkFile(c, code).getParentFile();
            File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete();
            File out = apkFile(c, code), tmp = new File(out.getPath() + ".part");
            download(url, tmp);
            if (!verify(c, tmp, code)) { tmp.delete(); p.edit().putString("updError", "The download didn't pass the safety check").apply(); return; }
            tmp.renameTo(out);
            p.edit().putLong("updReady", code).apply();
        } catch (Exception e) {
            p.edit().putString("updError", String.valueOf(e.getMessage())).apply();
        }
    }

    static void download(String url, File to) throws Exception {
        for (int hop = 0; hop < 5; hop++) {
            HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
            con.setInstanceFollowRedirects(false);
            con.setRequestProperty("User-Agent", "StrongSteady-App");
            con.setConnectTimeout(15000); con.setReadTimeout(60000);
            int code = con.getResponseCode();
            if (code >= 300 && code < 400) { url = con.getHeaderField("Location"); continue; }
            if (code != 200) throw new Exception("Download failed (" + code + ")");
            try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(to)) {
                byte[] b = new byte[64 * 1024]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n);
            }
            return;
        }
        throw new Exception("Too many redirects");
    }

    /** Same app, newer version, and signed with exactly the same key as the installed app. */
    @SuppressWarnings("deprecation")
    static boolean verify(Context c, File apk, long code) {
        try {
            PackageManager pm = c.getPackageManager();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo nu = pm.getPackageArchiveInfo(apk.getPath(), flags);
            PackageInfo me = pm.getPackageInfo(c.getPackageName(), flags);
            if (nu == null || !c.getPackageName().equals(nu.packageName)) return false;
            long nc = Build.VERSION.SDK_INT >= 28 ? nu.getLongVersionCode() : nu.versionCode;
            if (nc != code || nc <= currentCode(c)) return false;
            Signature[] a, b;
            if (Build.VERSION.SDK_INT >= 28) {
                if (nu.signingInfo == null || me.signingInfo == null) return false;
                a = nu.signingInfo.getApkContentsSigners(); b = me.signingInfo.getApkContentsSigners();
            } else { a = nu.signatures; b = me.signatures; }
            if (a == null || b == null || a.length == 0) return false;
            return Arrays.equals(a[0].toByteArray(), b[0].toByteArray());
        } catch (Exception e) { return false; }
    }

    static boolean ready(Context c) {
        long r = prefs(c).getLong("updReady", 0);
        return r > currentCode(c) && apkFile(c, r).exists();
    }

    /** Hand the downloaded update to Android's installer. fromApp = the person tapped "Install". */
    static boolean install(Context c, boolean fromApp) {
        if (!ready(c) || !canInstall(c)) return false;
        long code = prefs(c).getLong("updReady", 0);
        File apk = apkFile(c, code);
        try {
            PackageInstaller pi = c.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            sp.setAppPackageName(c.getPackageName());
            if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            int id = pi.createSession(sp);
            try (PackageInstaller.Session s = pi.openSession(id)) {
                try (InputStream in = new FileInputStream(apk); OutputStream out = s.openWrite("strong-steady.apk", 0, apk.length())) {
                    byte[] b = new byte[64 * 1024]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n);
                    s.fsync(out);
                }
                Intent done = new Intent(c, UpdateReceiver.class).putExtra("fromApp", fromApp);
                int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent pend = PendingIntent.getBroadcast(c, 55, done, fl);
                s.commit(pend.getIntentSender());
            }
            prefs(c).edit().putBoolean("updAsked", fromApp).apply();
            return true;
        } catch (Exception e) {
            prefs(c).edit().putString("updError", String.valueOf(e.getMessage())).apply();
            return false;
        }
    }

    /** True while the app is on screen (so an update never interrupts someone mid-session). */
    static boolean onScreen() {
        android.app.ActivityManager.RunningAppProcessInfo i = new android.app.ActivityManager.RunningAppProcessInfo();
        android.app.ActivityManager.getMyMemoryState(i);
        return i.importance <= android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
    }

    /** Install quietly when Android allows it (Android 12+, after the first update) and the app isn't on screen. */
    static void quietInstallIfPossible(Context c) {
        if (Build.VERSION.SDK_INT >= 31 && ready(c) && canInstall(c) && !onScreen() && !prefs(c).getBoolean("updNeedsTap", false)) install(c, false);
    }

    /** Called from the background job every ~15 minutes: check GitHub hourly, install as soon as it's safe. */
    static void backgroundTick(Context c) {
        check(c, false);
        quietInstallIfPossible(c);
    }
}

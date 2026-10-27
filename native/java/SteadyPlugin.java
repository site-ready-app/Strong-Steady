package io.github.sitereadyapp.strongsteady;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.util.Locale;

/** The bridge between the app's screens and the phone: steps, reminders, speech, sharing, keeping the screen on. */
@CapacitorPlugin(name = "Steady", permissions = {
        @Permission(alias = "activity", strings = {Manifest.permission.ACTIVITY_RECOGNITION}),
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class SteadyPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.UK);
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.ENGLISH);
                tts.setSpeechRate(0.9f);
                applySavedVoice();
                ttsReady = true;
            }
        });
        Nudges.channel(getContext());
        Nudges.schedule(getContext());
    }

    @Override protected void handleOnDestroy() { if (tts != null) tts.shutdown(); }

    private void applySavedVoice() {
        String name = StepStore.prefs(getContext()).getString("voiceName", "");
        if (name.isEmpty() || tts == null) return;
        try { for (android.speech.tts.Voice v : tts.getVoices()) if (v.getName().equals(name)) { tts.setVoice(v); return; } } catch (Exception ignored) {}
    }

    /** English voices installed on the phone (Android doesn't say which are female or male; the app recognises known names). */
    @PluginMethod public void voices(PluginCall call) {
        JSObject r = new JSObject(); com.getcapacitor.JSArray list = new com.getcapacitor.JSArray();
        r.put("ready", ttsReady);
        try {
            if (tts != null && ttsReady && tts.getVoices() != null) for (android.speech.tts.Voice v : tts.getVoices()) {
                if (v.getLocale() == null || !"en".equals(v.getLocale().getLanguage())) continue;
                if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                JSObject o = new JSObject();
                o.put("id", v.getName()); o.put("lang", v.getLocale().toLanguageTag());
                o.put("local", !v.isNetworkConnectionRequired()); o.put("quality", v.getQuality());
                list.put(o);
            }
            if (tts != null && tts.getVoice() != null) r.put("current", tts.getVoice().getName());
        } catch (Exception ignored) {}
        r.put("voices", list); call.resolve(r);
    }

    @PluginMethod public void setVoice(PluginCall call) {
        String id = call.getString("id", "");
        boolean ok = false;
        try { for (android.speech.tts.Voice v : tts.getVoices()) if (v.getName().equals(id)) { ok = tts.setVoice(v) == TextToSpeech.SUCCESS; break; } } catch (Exception ignored) {}
        if (ok) StepStore.prefs(getContext()).edit().putString("voiceName", id).apply();
        JSObject r = new JSObject(); r.put("ok", ok); call.resolve(r);
    }

    @PluginMethod public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sensor", StepStore.hasSensor(getContext()));
        r.put("steps", StepStore.available(getContext()));
        r.put("notify", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod public void requestStepPermission(PluginCall call) {
        if (!StepStore.hasSensor(getContext())) { JSObject r = new JSObject(); r.put("granted", false); r.put("noSensor", true); call.resolve(r); return; }
        if (Build.VERSION.SDK_INT < 29 || getPermissionState("activity") == PermissionState.GRANTED) { afterSteps(call); return; }
        requestPermissionForAlias("activity", call, "stepsCallback");
    }

    @PermissionCallback private void stepsCallback(PluginCall call) { afterSteps(call); }

    private void afterSteps(PluginCall call) {
        boolean ok = StepStore.available(getContext());
        if (ok) new Thread(() -> StepStore.sample(getContext())).start();
        JSObject r = new JSObject(); r.put("granted", ok); call.resolve(r);
    }

    @PluginMethod public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) { JSObject r = new JSObject(); r.put("granted", true); call.resolve(r); return; }
        requestPermissionForAlias("notifications", call, "notifyCallback");
    }

    @PermissionCallback private void notifyCallback(PluginCall call) {
        JSObject r = new JSObject(); r.put("granted", getPermissionState("notifications") == PermissionState.GRANTED); call.resolve(r);
    }

    @PluginMethod public void getSteps(PluginCall call) {
        new Thread(() -> {
            StepStore.sample(getContext());
            JSObject r = new JSObject();
            r.put("available", StepStore.available(getContext()));
            try { r.put("days", JSObject.fromJSONObject(StepStore.days(getContext()))); } catch (Exception e) { r.put("days", new JSObject()); }
            call.resolve(r);
        }).start();
    }

    @PluginMethod public void configure(PluginCall call) {
        try {
            JSONObject cfg = new JSONObject(call.getString("config", "{}"));
            cfg.put("configDate", StepStore.today());
            StepStore.prefs(getContext()).edit().putString("config", cfg.toString()).apply();
            Nudges.schedule(getContext());
            call.resolve();
        } catch (Exception e) { call.reject("Bad settings"); }
    }

    @PluginMethod public void testNudge(PluginCall call) {
        boolean ok = Nudges.notify(getContext(), "This is a test reminder", "Reminders are working. You'll get a gentle nudge at your exercise time if you haven't exercised yet.");
        JSObject r = new JSObject(); r.put("sent", ok); call.resolve(r);
    }

    @PluginMethod public void speak(PluginCall call) {
        if (tts != null && ttsReady) tts.speak(call.getString("text", ""), TextToSpeech.QUEUE_FLUSH, null, "steady");
        call.resolve();
    }

    @PluginMethod public void stopSpeaking(PluginCall call) { if (tts != null) tts.stop(); call.resolve(); }

    @PluginMethod public void keepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    @PluginMethod public void share(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        getActivity().startActivity(Intent.createChooser(send, "Share with"));
        call.resolve();
    }

    @PluginMethod public void updateStatus(PluginCall call) {
        android.content.SharedPreferences p = StepStore.prefs(getContext());
        JSObject r = new JSObject();
        r.put("current", Updater.currentCode(getContext()));
        r.put("currentName", Updater.currentName(getContext()));
        r.put("latest", p.getLong("updLatest", 0));
        r.put("latestName", p.getString("updLatestName", ""));
        r.put("notes", p.getString("updNotes", ""));
        r.put("ready", Updater.ready(getContext()));
        r.put("canInstall", Updater.canInstall(getContext()));
        r.put("lastCheck", p.getLong("updLastCheck", 0));
        r.put("error", p.getString("updError", ""));
        call.resolve(r);
    }

    @PluginMethod public void checkUpdate(PluginCall call) {
        boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));
        new Thread(() -> { Updater.check(getContext(), force ? 0 : Updater.CHECK_OPEN); updateStatus(call); }).start();
    }

    @PluginMethod public void installUpdate(PluginCall call) {
        boolean quiet = Boolean.TRUE.equals(call.getBoolean("quiet", false));
        new Thread(() -> {
            JSObject r = new JSObject();
            if (quiet) {   // the person has just left the app: install in the background if Android allows it
                try { Thread.sleep(1500); } catch (InterruptedException ignored) {}
                Updater.quietInstallIfPossible(getContext()); r.put("started", true);
            } else r.put("started", Updater.install(getContext(), true));
            call.resolve(r);
        }).start();
    }

    @PluginMethod public void openInstallSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    @PluginMethod public void openBatterySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}

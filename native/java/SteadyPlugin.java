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
                ttsReady = true;
            }
        });
        Nudges.channel(getContext());
        Nudges.schedule(getContext());
    }

    @Override protected void handleOnDestroy() { if (tts != null) tts.shutdown(); }

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

    @PluginMethod public void openBatterySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}

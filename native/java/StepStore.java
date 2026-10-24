package io.github.sitereadyapp.strongsteady;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Daily step counts from the phone's own step sensor (TYPE_STEP_COUNTER).
 * The sensor gives a running total since the phone was switched on, so we sample it now and then
 * (on app open and every ~15 minutes in the background) and add the difference to today's total.
 * No other app (Health Connect, HeyTap Health etc.) is needed.
 */
public class StepStore {
    static final String PREFS = "steady";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static String today() { return new SimpleDateFormat("yyyy-MM-dd", Locale.UK).format(new Date()); }

    static boolean hasSensor(Context c) {
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    static boolean hasPermission(Context c) {
        if (Build.VERSION.SDK_INT < 29) return true;
        return c.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean available(Context c) { return hasSensor(c) && hasPermission(c); }

    /** Reads the sensor once (waits up to 4 seconds) and records the steps. Safe to call from any background thread. */
    static synchronized void sample(Context c) {
        if (!available(c)) return;
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        Sensor s = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        final float[] value = {-1f};
        final CountDownLatch latch = new CountDownLatch(1);
        HandlerThread ht = new HandlerThread("steady-steps");
        ht.start();
        SensorEventListener l = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) { if (value[0] < 0) { value[0] = e.values[0]; latch.countDown(); } }
            @Override public void onAccuracyChanged(Sensor sensor, int a) {}
        };
        try {
            sm.registerListener(l, s, SensorManager.SENSOR_DELAY_NORMAL, new Handler(ht.getLooper()));
            latch.await(4, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        } finally {
            sm.unregisterListener(l);
            ht.quitSafely();
        }
        if (value[0] >= 0) record(c, value[0]);
    }

    static void record(Context c, float counter) {
        SharedPreferences p = prefs(c);
        float last = p.getFloat("lastCounter", -1f);
        String day = today();
        try {
            JSONObject days = new JSONObject(p.getString("days", "{}"));
            if (last >= 0) {
                float delta = counter - last;
                if (delta < 0) delta = counter;          // the phone was restarted, so the counter began again from 0
                if (delta > 60000) delta = 0;            // ignore anything implausible
                days.put(day, days.optInt(day, 0) + Math.round(delta));
            } else if (!days.has(day)) {
                days.put(day, 0);                        // first ever reading: start counting from here
            }
            // keep about four months
            if (days.length() > 130) {
                String oldest = null;
                for (Iterator<String> it = days.keys(); it.hasNext(); ) { String k = it.next(); if (oldest == null || k.compareTo(oldest) < 0) oldest = k; }
                if (oldest != null) days.remove(oldest);
            }
            p.edit().putFloat("lastCounter", counter).putString("days", days.toString()).apply();
        } catch (Exception ignored) {}
    }

    static JSONObject days(Context c) {
        try { return new JSONObject(prefs(c).getString("days", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static int todaySteps(Context c) { return days(c).optInt(today(), 0); }
}

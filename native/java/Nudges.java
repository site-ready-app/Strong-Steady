package io.github.sitereadyapp.strongsteady;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Random;
import java.util.concurrent.TimeUnit;

/**
 * Reminder logic. Settings come from the app (configure). Two kinds of check:
 *  - alarms at the person's exercise time and about 2.5 hours later (inexact, battery friendly, no special permission)
 *  - a background job every ~15 minutes that keeps the step count up to date
 * A reminder is only sent if: reminders are on, they're not unwell, they haven't exercised today,
 * it's before their cut-off time, and no more than two reminders have been sent today.
 */
public class Nudges {
    static final String CHANNEL = "reminders";
    static final int ALARM_MAIN = 101, ALARM_SECOND = 102;

    static JSONObject config(Context c) {
        try { return new JSONObject(StepStore.prefs(c).getString("config", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static int mins(String hhmm) {
        try { String[] p = hhmm.split(":"); return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]); } catch (Exception e) { return 630; }
    }

    static int nowMin() { Calendar c = Calendar.getInstance(); return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE); }

    /** Call after every configure and on boot. */
    static void schedule(Context c) {
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("steady-steps", ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(StepWorker.class, 15, TimeUnit.MINUTES).build());
        JSONObject cfg = config(c);
        int main = mins(cfg.optString("mainTime", "10:30"));
        setAlarm(c, ALARM_MAIN, main);
        setAlarm(c, ALARM_SECOND, main + 150);
    }

    static void setAlarm(Context c, int code, int minuteOfDay) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar t = Calendar.getInstance();
        t.set(Calendar.HOUR_OF_DAY, (minuteOfDay / 60) % 24);
        t.set(Calendar.MINUTE, minuteOfDay % 60);
        t.set(Calendar.SECOND, 0);
        if (t.getTimeInMillis() <= System.currentTimeMillis() + 30000) t.add(Calendar.DAY_OF_MONTH, 1);
        Intent i = new Intent(c, NudgeReceiver.class).putExtra("which", code);
        PendingIntent pi = PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pi);
    }

    /** Decide whether to remind, and do it. which = ALARM_MAIN, ALARM_SECOND or 0 (background check). */
    static void check(Context c, int which) {
        StepStore.sample(c);
        JSONObject cfg = config(c);
        if (!cfg.optBoolean("enabled", true)) return;
        String today = StepStore.today();
        if (cfg.optBoolean("illOpen", false)) return;
        if (cfg.optBoolean("illToday", false) && today.equals(cfg.optString("configDate"))) return;
        JSONArray done = cfg.optJSONArray("doneDates");
        if (done != null) for (int i = 0; i < done.length(); i++) if (today.equals(done.optString(i))) return;
        int now = nowMin(), main = mins(cfg.optString("mainTime", "10:30")), cut = mins(cfg.optString("cutoff", "16:00"));
        if (now >= cut || now < main - 5) return;
        SharedPreferences p = StepStore.prefs(c);
        int sent = today.equals(p.getString("sentDate", "")) ? p.getInt("sentCount", 0) : 0;
        if (sent >= 2) return;
        int steps = StepStore.todaySteps(c), goal = cfg.optInt("stepGoal", 3000);
        boolean stepsKnown = StepStore.available(c);
        String name = cfg.optString("name", "");
        String hi = name.isEmpty() ? "" : name + ", ";
        String title, text;
        if (sent == 0) {
            if (which == ALARM_SECOND) return; // first reminder comes at their exercise time
            String[] titles = {"It's exercise time!", "Time for your stars ⭐", "Ready when you are"};
            title = titles[new Random().nextInt(titles.length)];
            int streak = cfg.optInt("streak", 0);
            String stop = cfg.optString("nextStop", "");
            if (streak > 1) text = hi + "a short session keeps your " + streak + "-day streak going.";
            else if (!stop.isEmpty()) text = hi + "a short session takes you half a mile nearer " + stop + ".";
            else text = hi + "just a few minutes earns your first star today.";
        } else {
            if (now < main + 140) return;  // second reminder about 2.5 hours later
            boolean quiet = stepsKnown && steps < goal / 2;
            title = quiet ? "Fancy a little movement?" : "There's still time today";
            text = quiet ? hi + "it's been a quiet day so far (" + steps + " steps). Five minutes of chair exercises would do you good."
                         : hi + "your exercise session is still waiting. It only takes a few minutes.";
        }
        if (notify(c, title, text)) p.edit().putString("sentDate", today).putInt("sentCount", sent + 1).apply();
    }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Exercise reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("A gentle nudge if you haven't exercised yet");
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    static boolean notify(Context c, String title, String text) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        channel(c);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(c, 7, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_steady)
                .setContentTitle(title).setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(pi).setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try { NotificationManagerCompat.from(c).notify(1, b.build()); return true; } catch (SecurityException e) { return false; }
    }
}

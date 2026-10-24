package io.github.sitereadyapp.strongsteady;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires at the exercise time (and ~2.5 hours later), and after the phone restarts. */
public class NudgeReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent intent) {
        final PendingResult pr = goAsync();
        final Context app = c.getApplicationContext();
        final String action = intent.getAction();
        final int which = intent.getIntExtra("which", 0);
        new Thread(() -> {
            try {
                if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
                    StepStore.sample(app); // the step counter restarts at 0 after a reboot; StepStore handles that
                } else {
                    Nudges.check(app, which);
                }
                Nudges.schedule(app); // set tomorrow's alarms
            } catch (Exception ignored) {
            } finally { pr.finish(); }
        }).start();
    }
}

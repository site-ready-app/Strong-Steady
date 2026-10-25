package io.github.sitereadyapp.strongsteady;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** Hears back from Android's installer. If the phone wants the person to confirm, show its "Update?" screen (only when they tapped Install). */
public class UpdateReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        int status = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        boolean fromApp = i.getBooleanExtra("fromApp", false);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            if (fromApp) {
                Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(confirm); }
            } else {
                // A quiet overnight install wasn't allowed: wait for the person to tap "Install" in the app.
                StepStore.prefs(c).edit().putBoolean("updNeedsTap", true).apply();
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            StepStore.prefs(c).edit().putString("updError", i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)).apply();
        }
    }
}

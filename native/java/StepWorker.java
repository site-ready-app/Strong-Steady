package io.github.sitereadyapp.strongsteady;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Runs every ~15 minutes: updates the step count and, if it's reminder time, checks whether to nudge. */
public class StepWorker extends Worker {
    public StepWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull @Override public Result doWork() {
        try { Nudges.check(getApplicationContext(), 0); } catch (Exception ignored) {}
        return Result.success();
    }
}

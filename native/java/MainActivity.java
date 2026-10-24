package io.github.sitereadyapp.strongsteady;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SteadyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

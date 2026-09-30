package com.guardian.safety;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EmergencyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

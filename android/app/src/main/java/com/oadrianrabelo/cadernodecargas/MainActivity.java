package com.oadrianrabelo.cadernodecargas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local (não vem do npm), usado pelo salvamento no Google Drive.
        registerPlugin(DriveAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package com.oadrianrabelo.cadernodecargas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locais (não vêm do npm): login do Google Drive e atualização automática.
        registerPlugin(DriveAuthPlugin.class);
        registerPlugin(WebUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

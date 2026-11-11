package com.oadrianrabelo.cadernodecargas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locais (não vêm do npm): login do Google Drive, atualização automática e recursos do aparelho
        // (descanso com alarme, vibração, lembrete, atalhos, galeria...).
        registerPlugin(DriveAuthPlugin.class);
        registerPlugin(WebUpdatePlugin.class);
        registerPlugin(CadernoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

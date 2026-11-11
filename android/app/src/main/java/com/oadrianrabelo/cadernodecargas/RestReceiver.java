package com.oadrianrabelo.cadernodecargas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarmes do descanso e do lembrete, botões da notificação (+15 s, Pular) e religar o lembrete após reiniciar. */
public class RestReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        switch (a) {
            case Rest.ACTION_END:
                // Alarme antigo (o descanso foi reagendado ou cancelado): ignora.
                long end = Rest.endAt(c);
                if (end == 0 || end > System.currentTimeMillis() + 1500) return;
                Rest.finish(c);
                break;
            case Rest.ACTION_ADD:
                Rest.add(c, 15000);
                break;
            case Rest.ACTION_SKIP:
                Rest.skip(c);
                break;
            case Rest.ACTION_REMIND:
                Rest.remind(c);
                break;
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
                Rest.scheduleReminder(c);
                break;
            default:
                break;
        }
    }
}

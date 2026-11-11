package com.oadrianrabelo.cadernodecargas;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Calendar;

/**
 * Descanso e lembrete de treino no lado nativo: alarmes (tocam com a tela bloqueada), notificações
 * e vibração. O estado fica em SharedPreferences, então funciona mesmo com o app fechado.
 */
final class Rest {

    static final String PREFS = "CadernoNative";
    static final String CH_COUNT = "descanso_contagem";
    static final String CH_END = "descanso_fim";
    static final String CH_REMIND = "lembrete_treino";
    static final int ID_COUNT = 1001;
    static final int ID_END = 1002;
    static final int ID_REMIND = 1003;
    static final String ACTION_END = "com.oadrianrabelo.cadernodecargas.REST_END";
    static final String ACTION_ADD = "com.oadrianrabelo.cadernodecargas.REST_ADD";
    static final String ACTION_SKIP = "com.oadrianrabelo.cadernodecargas.REST_SKIP";
    static final String ACTION_REMIND = "com.oadrianrabelo.cadernodecargas.REMIND";
    static final long[] PATTERN = { 0, 450, 180, 450, 180, 700 };

    /** Avisado quando o estado do descanso muda fora do app (botões da notificação, fim do alarme). */
    interface Listener { void onRest(long endAt, boolean finished); }
    static Listener listener;
    /** O app está na frente? Aí o fim do descanso só vibra (a tela já mostra "Próxima série!"). */
    static boolean foreground;

    private Rest() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel count = new NotificationChannel(CH_COUNT, "Cronômetro de descanso", NotificationManager.IMPORTANCE_LOW);
        count.setDescription("Contagem do descanso na tela de bloqueio");
        count.setShowBadge(false);
        count.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        NotificationChannel end = new NotificationChannel(CH_END, "Fim do descanso", NotificationManager.IMPORTANCE_HIGH);
        end.setDescription("Vibra e avisa quando o descanso acaba");
        end.enableVibration(true);
        end.setVibrationPattern(PATTERN);
        end.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        end.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        NotificationChannel remind = new NotificationChannel(CH_REMIND, "Lembrete de treino", NotificationManager.IMPORTANCE_DEFAULT);
        remind.setDescription("Lembra de treinar nos dias escolhidos");
        nm.createNotificationChannel(count);
        nm.createNotificationChannel(end);
        nm.createNotificationChannel(remind);
    }

    static int flags() { return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0); }

    static PendingIntent broadcast(Context c, String action, int code) {
        Intent i = new Intent(c, RestReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(c, code, i, flags());
    }

    static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 10, i, flags());
    }

    static void exact(Context c, long at, PendingIntent pi) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        boolean canExact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (Build.VERSION.SDK_INT >= 23) {
            if (canExact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
    }

    // ---------- Descanso ----------

    static long endAt(Context c) { return prefs(c).getLong("restEnd", 0); }

    static void start(Context c, long endAt, String label) {
        prefs(c).edit().putLong("restEnd", endAt).putString("restLabel", label == null ? "" : label).apply();
        NotificationManagerCompat.from(c).cancel(ID_END);
        exact(c, endAt, broadcast(c, ACTION_END, 1));
        showCount(c);
    }

    static void cancel(Context c) {
        prefs(c).edit().putLong("restEnd", 0).apply();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(broadcast(c, ACTION_END, 1));
        NotificationManagerCompat.from(c).cancel(ID_COUNT);
    }

    static boolean canNotify(Context c) {
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    @SuppressWarnings("MissingPermission")
    static void showCount(Context c) {
        long end = endAt(c);
        if (end <= System.currentTimeMillis() || !canNotify(c)) return;
        channels(c);
        String label = prefs(c).getString("restLabel", "");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_COUNT)
            .setSmallIcon(R.drawable.ic_stat_caderno)
            .setContentTitle("Descanso")
            .setContentText(label.isEmpty() ? "Próxima série em seguida" : label)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(end)
            .setShowWhen(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp(c))
            .setTimeoutAfter(Math.max(1000, end - System.currentTimeMillis() + 500))
            .addAction(0, "+15 s", broadcast(c, ACTION_ADD, 2))
            .addAction(0, "Pular", broadcast(c, ACTION_SKIP, 3));
        NotificationManagerCompat.from(c).notify(ID_COUNT, b.build());
    }

    @SuppressWarnings("MissingPermission")
    static void finish(Context c) {
        String label = prefs(c).getString("restLabel", "");
        prefs(c).edit().putLong("restEnd", 0).apply();
        NotificationManagerCompat.from(c).cancel(ID_COUNT);
        vibrate(c, PATTERN, true);
        if (!foreground && canNotify(c)) {
            channels(c);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_END)
                .setSmallIcon(R.drawable.ic_stat_caderno)
                .setContentTitle("Descanso acabou")
                .setContentText(label.isEmpty() ? "Hora da próxima série" : "Próxima série · " + label)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setVibrate(PATTERN)
                .setAutoCancel(true)
                .setTimeoutAfter(90000)
                .setContentIntent(openApp(c));
            NotificationManagerCompat.from(c).notify(ID_END, b.build());
        }
        if (listener != null) listener.onRest(0, true);
    }

    static void add(Context c, long ms) {
        long end = Math.max(System.currentTimeMillis(), endAt(c)) + ms;
        start(c, end, prefs(c).getString("restLabel", ""));
        if (listener != null) listener.onRest(end, false);
    }

    static void skip(Context c) {
        cancel(c);
        if (listener != null) listener.onRest(0, false);
    }

    static void vibrate(Context c, long[] pattern, boolean alarm) {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) v = ((VibratorManager) c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator();
            else v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(alarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).build();
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1), aa);
            else v.vibrate(pattern, -1, aa);
        } catch (Exception ignored) {
            // Sem vibração neste aparelho.
        }
    }

    // ---------- Lembrete de treino ----------

    /** days: bits 0..6 = domingo..sábado (como Date.getDay() no JavaScript). */
    static void scheduleReminder(Context c) {
        SharedPreferences p = prefs(c);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = broadcast(c, ACTION_REMIND, 4);
        am.cancel(pi);
        int days = p.getInt("remDays", 0);
        if (!p.getBoolean("remOn", false) || days == 0) return;
        int hour = p.getInt("remHour", 18), minute = p.getInt("remMin", 0);
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
        cal.set(Calendar.HOUR_OF_DAY, hour); cal.set(Calendar.MINUTE, minute);
        for (int i = 0; i < 8; i++) {
            int dow = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0 = domingo
            if (cal.getTimeInMillis() > System.currentTimeMillis() + 5000 && (days & (1 << dow)) != 0) break;
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        exact(c, cal.getTimeInMillis(), pi);
    }

    static String today() {
        Calendar cal = Calendar.getInstance();
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
    }

    @SuppressWarnings("MissingPermission")
    static void remind(Context c) {
        SharedPreferences p = prefs(c);
        int dow = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1;
        boolean due = p.getBoolean("remOn", false) && (p.getInt("remDays", 0) & (1 << dow)) != 0 && !today().equals(p.getString("lastDay", ""));
        if (due && canNotify(c)) {
            channels(c);
            String label = p.getString("remLabel", "");
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_REMIND)
                .setSmallIcon(R.drawable.ic_stat_caderno)
                .setContentTitle("Hora do treino")
                .setContentText(label.isEmpty() ? "Seu caderno está esperando" : "Hoje: " + label)
                .setAutoCancel(true)
                .setContentIntent(openApp(c));
            NotificationManagerCompat.from(c).notify(ID_REMIND, b.build());
        }
        scheduleReminder(c);
    }
}

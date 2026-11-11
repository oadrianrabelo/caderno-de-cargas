package com.oadrianrabelo.cadernodecargas;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Recursos do aparelho para o app web: descanso com alarme e notificação (tela bloqueada),
 * vibração, tela acesa, barras do sistema na cor do tema, botão voltar, lembrete de treino,
 * atalhos do ícone, salvar imagem na galeria e instalar um APK novo.
 */
@CapacitorPlugin(
    name = "Caderno",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class CadernoPlugin extends Plugin {

    private String pendingAction;

    @Override
    public void load() {
        Rest.channels(getContext());
        Rest.listener = (endAt, finished) -> {
            JSObject o = new JSObject();
            o.put("endAt", endAt);
            o.put("finished", finished);
            notifyListeners("rest", o);
        };
        pendingAction = actionOf(getActivity().getIntent());
        // Voltar: o app fecha o que estiver aberto (folha, janela, modo foco). Sem nada aberto, vai para o fundo
        // (não fecha, para o descanso e o treino continuarem como estavam).
        getBridge().executeOnMainThread(() -> getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return !!(window.CGBack&&window.CGBack())}catch(e){return false}})()",
                    (v) -> { if (!"true".equals(v)) getActivity().moveTaskToBack(true); });
            }
        }));
        Rest.scheduleReminder(getContext());
    }

    @Override
    protected void handleOnResume() { Rest.foreground = true; }

    @Override
    protected void handleOnPause() { Rest.foreground = false; }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        String a = actionOf(intent);
        if (a == null) return;
        JSObject o = new JSObject();
        o.put("action", a);
        notifyListeners("shortcut", o, true);
    }

    private static String actionOf(Intent intent) {
        if (intent == null || intent.getData() == null) return null;
        Uri u = intent.getData();
        return "caderno".equals(u.getScheme()) ? u.getHost() : null;
    }

    private SharedPreferences prefs() { return Rest.prefs(getContext()); }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject o = new JSObject();
        o.put("sdk", Build.VERSION.SDK_INT);
        o.put("notifications", Rest.canNotify(getContext()));
        o.put("galleryOk", Build.VERSION.SDK_INT >= 29);
        call.resolve(o);
    }

    /** Ação do atalho que abriu o app (consome: devolve só uma vez). */
    @PluginMethod
    public void launchAction(PluginCall call) {
        JSObject o = new JSObject();
        o.put("action", pendingAction);
        pendingAction = null;
        call.resolve(o);
    }

    // ---------- Permissão de notificação (Android 13+) ----------

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject o = new JSObject(); o.put("granted", Rest.canNotify(getContext())); call.resolve(o);
            return;
        }
        requestPermissionForAlias("notifications", call, "notifCallback");
    }

    @PermissionCallback
    private void notifCallback(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", Rest.canNotify(getContext()));
        call.resolve(o);
    }

    // ---------- Descanso ----------

    @PluginMethod
    public void restStart(PluginCall call) {
        Long end = call.getLong("endAt");
        if (end == null) { call.reject("endAt obrigatório"); return; }
        Rest.start(getContext(), end, call.getString("label", ""));
        call.resolve();
    }

    @PluginMethod
    public void restCancel(PluginCall call) {
        Rest.cancel(getContext());
        call.resolve();
    }

    @PluginMethod
    public void restState(PluginCall call) {
        JSObject o = new JSObject();
        o.put("endAt", Rest.endAt(getContext()));
        call.resolve(o);
    }

    // ---------- Vibração e tela ----------

    /** kind: "tap" (toque leve), "confirm" (série marcada), "success" (recorde), "warn". */
    @PluginMethod
    public void haptic(PluginCall call) {
        String kind = call.getString("kind", "tap");
        getBridge().executeOnMainThread(() -> {
            View v = getBridge().getWebView();
            switch (kind) {
                case "success":
                    Rest.vibrate(getContext(), new long[] { 0, 35, 70, 35, 70, 60 }, false);
                    break;
                case "warn":
                    Rest.vibrate(getContext(), new long[] { 0, 60, 90, 60 }, false);
                    break;
                case "confirm":
                    v.performHapticFeedback(Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY);
                    break;
                default:
                    v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        getBridge().executeOnMainThread(() -> {
            Window w = getActivity().getWindow();
            if (on) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    /** { color: "#rrggbb", dark: true|false } → barras do sistema na cor do tema, ícones claros ou escuros. */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void setBars(PluginCall call) {
        String color = call.getString("color", "#000000");
        boolean dark = call.getBoolean("dark", false);
        getBridge().executeOnMainThread(() -> {
            try {
                int c = Color.parseColor(color);
                Window w = getActivity().getWindow();
                w.getDecorView().setBackgroundColor(c);
                if (Build.VERSION.SDK_INT < 35) { w.setStatusBarColor(c); w.setNavigationBarColor(c); }
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
                ic.setAppearanceLightStatusBars(!dark);
                ic.setAppearanceLightNavigationBars(!dark);
                call.resolve();
            } catch (Exception e) {
                call.reject("Cor inválida");
            }
        });
    }

    // ---------- Lembrete de treino ----------

    @PluginMethod
    public void reminderSet(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        e.putBoolean("remOn", call.getBoolean("on", false));
        int days = 0;
        JSArray arr = call.getArray("days");
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                int d = arr.optInt(i, -1);
                if (d >= 0 && d <= 6) days |= 1 << d;
            }
        }
        e.putInt("remDays", days);
        e.putInt("remHour", Math.max(0, Math.min(23, call.getInt("hour", 18))));
        e.putInt("remMin", Math.max(0, Math.min(59, call.getInt("minute", 0))));
        e.apply();
        Rest.scheduleReminder(getContext());
        reminderGet(call);
    }

    @PluginMethod
    public void reminderGet(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject o = new JSObject();
        o.put("on", p.getBoolean("remOn", false));
        JSArray days = new JSArray();
        int bits = p.getInt("remDays", 0);
        for (int d = 0; d <= 6; d++) if ((bits & (1 << d)) != 0) days.put(d);
        o.put("days", days);
        o.put("hour", p.getInt("remHour", 18));
        o.put("minute", p.getInt("remMin", 0));
        call.resolve(o);
    }

    /** O app avisa o dia do último treino e o próximo treino (texto do lembrete). */
    @PluginMethod
    public void trained(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        String day = call.getString("day");
        if (day != null) e.putString("lastDay", day);
        String label = call.getString("next");
        if (label != null) e.putString("remLabel", label);
        e.apply();
        call.resolve();
    }

    // ---------- Galeria ----------

    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data"), name = call.getString("name", "caderno.png");
        if (data == null) { call.reject("Sem imagem"); return; }
        if (Build.VERSION.SDK_INT < 29) { call.reject("unsupported"); return; }
        getBridge().execute(() -> {
            try {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Caderno de Cargas");
                cv.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("insert");
                try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                    out.write(Base64.decode(data, Base64.DEFAULT));
                }
                cv.clear();
                cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContext().getContentResolver().update(uri, cv, null, null);
                call.resolve();
            } catch (Exception e) {
                call.reject("Não consegui salvar na galeria");
            }
        });
    }

    // ---------- Instalar APK novo ----------

    /** { url, name } → baixa o APK e abre o instalador do Android. Sem permissão, abre a tela para permitir. */
    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url"), name = call.getString("name", "caderno.apk");
        if (url == null || !url.startsWith("https://")) { call.reject("Endereço inválido"); return; }
        Activity act = getActivity();
        if (Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
            act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName())));
            call.reject("permission");
            return;
        }
        getBridge().execute(() -> {
            File dir = new File(getContext().getCacheDir(), "apk");
            File out = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
            try {
                dir.mkdirs();
                HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
                con.setInstanceFollowRedirects(true);
                con.setConnectTimeout(20000);
                con.setReadTimeout(60000);
                int total = con.getContentLength(), done = 0, last = -1;
                try (InputStream in = con.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n);
                        done += n;
                        int pct = total > 0 ? (int) (done * 100L / total) : -1;
                        if (pct != last && pct % 5 == 0) {
                            last = pct;
                            JSObject p = new JSObject(); p.put("pct", pct); notifyListeners("download", p);
                        }
                    }
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out);
                Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(i);
                call.resolve();
            } catch (Exception e) {
                out.delete();
                call.reject("Não consegui baixar o APK");
            }
        });
    }
}

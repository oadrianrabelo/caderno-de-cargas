package com.oadrianrabelo.cadernodecargas;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.plugin.WebView;
import java.io.File;

/**
 * Atualização do app web sem reinstalar o APK. O JavaScript baixa a versão nova para uma pasta
 * do app e chama apply(); o WebView passa a servir essa pasta. A versão nova precisa chamar
 * confirm() em até 20 segundos; só então ela fica valendo nas próximas aberturas. Se não
 * confirmar (tela branca, erro de JavaScript), volta para a versão anterior e marca a nova como ruim.
 * Quando um APK novo é instalado, o Capacitor volta sozinho para a versão embutida no APK.
 */
@CapacitorPlugin(name = "WebUpdate")
public class WebUpdatePlugin extends Plugin {

    private static final String PREFS = "CadernoWebUpdate";
    private static final long CONFIRM_TIMEOUT_MS = 20000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String pendingPath;
    private int pendingBuild;
    private String previousPath;
    private final Runnable rollback = () -> {
        if (pendingPath == null) return;
        prefs().edit().putInt("bad", pendingBuild).apply();
        pendingPath = null;
        restorePrevious();
    };

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
    }

    private void restorePrevious() {
        if (previousPath != null && previousPath.startsWith("/") && new File(previousPath, "index.html").exists()) {
            bridge.setServerBasePath(previousPath);
        } else {
            bridge.setServerAssetPath("public");
        }
    }

    /** { path, build } → passa a servir a pasta (recarrega o app) e espera confirm(). */
    @PluginMethod
    public void apply(PluginCall call) {
        String path = call.getString("path");
        int build = call.getInt("build", 0);
        if (path == null || !new File(path, "index.html").exists()) {
            call.reject("Pacote da atualização incompleto");
            return;
        }
        if (build == prefs().getInt("bad", -1)) {
            call.reject("Esta versão já falhou antes");
            return;
        }
        previousPath = bridge.getServerBasePath();
        pendingPath = path;
        pendingBuild = build;
        handler.removeCallbacks(rollback);
        handler.postDelayed(rollback, CONFIRM_TIMEOUT_MS);
        call.resolve();
        bridge.setServerBasePath(path);
    }

    /** A versão que acabou de abrir funciona: grava para as próximas aberturas. */
    @PluginMethod
    public void confirm(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingPath != null && pendingPath.equals(bridge.getServerBasePath())) {
            handler.removeCallbacks(rollback);
            getContext()
                .getSharedPreferences(WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE)
                .edit()
                .putString(WebView.CAP_SERVER_PATH, pendingPath)
                .apply();
            pendingPath = null;
            ret.put("applied", true);
        } else {
            ret.put("applied", false);
        }
        call.resolve(ret);
    }

    /** { bad, path }: última versão que falhou e a pasta servida agora. */
    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("bad", prefs().getInt("bad", 0));
        ret.put("path", bridge.getServerBasePath());
        call.resolve(ret);
    }

    /** Volta para a versão que veio dentro do APK. */
    @PluginMethod
    public void reset(PluginCall call) {
        handler.removeCallbacks(rollback);
        pendingPath = null;
        getContext().getSharedPreferences(WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE).edit().remove(WebView.CAP_SERVER_PATH).apply();
        call.resolve();
        bridge.setServerAssetPath("public");
    }
}

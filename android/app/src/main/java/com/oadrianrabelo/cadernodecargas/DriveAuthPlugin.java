package com.oadrianrabelo.cadernodecargas;

import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;
import java.util.List;

/**
 * Pede ao Google um token de acesso ao Drive, só com o escopo drive.file
 * (o app enxerga apenas os arquivos que ele mesmo criou). Não há servidor:
 * o Google identifica o app pelo pacote e pela assinatura do APK.
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {

    private static final List<Scope> SCOPES = Collections.singletonList(new Scope("https://www.googleapis.com/auth/drive.file"));

    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;

    @Override
    public void load() {
        launcher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), (result) -> {
            PluginCall call = pending;
            pending = null;
            if (call == null) return;
            if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                call.reject("Login no Google cancelado", "CANCELED");
                return;
            }
            try {
                resolveToken(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(result.getData()));
            } catch (ApiException e) {
                call.reject("Google recusou o acesso (" + e.getStatusCode() + ")", "FAILED");
            }
        });
    }

    /** { interactive: boolean } → { token }. Sem interactive, falha com NEEDS_LOGIN em vez de abrir a tela do Google. */
    @PluginMethod
    public void getToken(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(SCOPES).build();
        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener((result) -> {
                if (!result.hasResolution()) {
                    resolveToken(call, result);
                    return;
                }
                if (!interactive || result.getPendingIntent() == null) {
                    call.reject("Entre na conta Google de novo", "NEEDS_LOGIN");
                    return;
                }
                if (pending != null) pending.reject("Login substituído", "CANCELED");
                pending = call;
                launcher.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
            })
            .addOnFailureListener((e) -> call.reject("Não consegui falar com o Google: " + e.getMessage(), "FAILED"));
    }

    /** { token } → descarta um token que o Drive recusou, para o próximo getToken trazer um novo. */
    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.resolve();
            return;
        }
        new Thread(() -> {
            try {
                GoogleAuthUtil.clearToken(getContext(), token);
            } catch (Exception e) {
                // Token já inválido: nada a fazer.
            }
            call.resolve();
        }).start();
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("O Google não devolveu um token", "FAILED");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("token", token);
        call.resolve(ret);
    }
}

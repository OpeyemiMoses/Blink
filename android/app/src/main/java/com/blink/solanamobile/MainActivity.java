package com.blink.solanamobile;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {

    @CapacitorPlugin(name = "NativeBiometric")
    public static class NativeBiometricPlugin extends Plugin {
        @PluginMethod
        public void isAvailable(PluginCall call) {
            try {
                BiometricManager biometricManager = BiometricManager.from(getContext());
                int canAuth = biometricManager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG | 
                    BiometricManager.Authenticators.BIOMETRIC_WEAK | 
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );
                JSObject ret = new JSObject();
                ret.put("available", canAuth == BiometricManager.BIOMETRIC_SUCCESS);
                ret.put("code", canAuth);
                call.resolve(ret);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("available", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        }

        @PluginMethod
        public void authenticate(PluginCall call) {
            String title = call.getString("title", "Authorize Solana Transaction");
            String subtitle = call.getString("subtitle", "Confirm your fingerprint or screen lock");

            getActivity().runOnUiThread(() -> {
                try {
                    Executor executor = ContextCompat.getMainExecutor(getContext());
                    BiometricPrompt prompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", errString.toString());
                            ret.put("errorCode", errorCode);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                        }
                    });

                    BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG | 
                            BiometricManager.Authenticators.BIOMETRIC_WEAK | 
                            BiometricManager.Authenticators.DEVICE_CREDENTIAL
                        )
                        .build();

                    prompt.authenticate(promptInfo);
                } catch (Exception e) {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("error", e.getMessage());
                    call.resolve(ret);
                }
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBiometricPlugin.class);
        super.onCreate(savedInstanceState);
        configureWebView();
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
    }

    private void configureWebView() {
        try {
            WebView.setWebContentsDebuggingEnabled(true);
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

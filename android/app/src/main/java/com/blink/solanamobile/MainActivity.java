package com.blink.solanamobile;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
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

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {

    @CapacitorPlugin(name = "NativeFileSaver")
    public static class NativeFileSaverPlugin extends Plugin {
        @PluginMethod
        public void saveImage(PluginCall call) {
            String dataUrl = call.getString("dataUrl");
            String filename = call.getString("filename", "blink_image_" + System.currentTimeMillis() + ".png");
            String title = call.getString("title", "Blink Image");
            boolean share = Boolean.TRUE.equals(call.getBoolean("share", false));

            if (dataUrl == null || dataUrl.isEmpty()) {
                call.reject("dataUrl is required");
                return;
            }

            getActivity().runOnUiThread(() -> {
                try {
                    String base64Data = dataUrl;
                    if (base64Data.contains(",")) {
                        base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
                    }
                    byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);

                    ContentResolver resolver = getContext().getContentResolver();
                    Uri imageUri = null;

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Blink");
                        values.put(MediaStore.Images.Media.IS_PENDING, 1);

                        imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                        if (imageUri != null) {
                            try (OutputStream out = resolver.openOutputStream(imageUri)) {
                                if (out != null) {
                                    out.write(imageBytes);
                                    out.flush();
                                }
                            }
                            values.clear();
                            values.put(MediaStore.Images.Media.IS_PENDING, 0);
                            resolver.update(imageUri, values, null, null);
                        }
                    } else {
                        File picturesDir = new File(
                            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                            "Blink"
                        );
                        if (!picturesDir.exists()) {
                            picturesDir.mkdirs();
                        }
                        File imageFile = new File(picturesDir, filename);
                        try (FileOutputStream out = new FileOutputStream(imageFile)) {
                            out.write(imageBytes);
                            out.flush();
                        }
                        MediaScannerConnection.scanFile(
                            getContext(),
                            new String[]{imageFile.getAbsolutePath()},
                            new String[]{"image/png"},
                            null
                        );
                        imageUri = Uri.fromFile(imageFile);
                    }

                    if (imageUri == null) {
                        call.reject("Failed to create image file");
                        return;
                    }

                    if (share) {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType("image/png");
                        shareIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
                        shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(Intent.createChooser(shareIntent, "Share " + title));
                    }

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("filename", filename);
                    ret.put("uri", imageUri.toString());
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to save image: " + e.getMessage());
                }
            });
        }
    }

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
        registerPlugin(NativeFileSaverPlugin.class);
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
            WebView.setWebContentsDebuggingEnabled(false);
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(false);
                settings.setAllowContentAccess(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(false);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

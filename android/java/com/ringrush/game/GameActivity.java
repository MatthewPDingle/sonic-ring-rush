package com.ringrush.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.Configuration;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

/** Offline Android host. Resizing retains the same WebView and running race. */
public final class GameActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView game;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocus;
    private boolean loaded;
    private boolean foreground;
    private boolean focused;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16,36,72));
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(16,36,72));
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        game.addJavascriptInterface(new AndroidGame(), "AndroidGame");
        game.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri) || !"GET".equals(request.getMethod())) return missing();
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/") || path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0) return missing();
                try {
                    String name = path.substring("/assets/".length());
                    return new WebResourceResponse(mime(name), "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open("www/"+name));
                } catch (IOException error) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public void onPageFinished(WebView view, String url) {
                loaded = true;
                notifyForeground();
            }
            @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                // A killed GPU process should offer recovery rather than crash the app.
                root.removeView(view); view.destroy(); game = null;
                new AlertDialog.Builder(GameActivity.this).setTitle("Let's get running again")
                    .setMessage("Android stopped the 3D view. Your best times are saved.")
                    .setPositiveButton("Restart", (dialog, which) -> recreate())
                    .setNegativeButton("Close", (dialog, which) -> finish()).setCancelable(false).show();
                return true;
            }
        });
        game.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                Log.d("RingRush", message.messageLevel()+": "+message.message()); return true;
            }
        });
        root.addView(game, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view,insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.displayCutout() | WindowInsets.Type.systemBars());
                Insets gestures = insets.getInsets(WindowInsets.Type.systemGestures());
                view.setPadding(safe.left,safe.top,safe.right,Math.max(safe.bottom,gestures.bottom));
                return WindowInsets.CONSUMED;
            });
        }
        immersive();
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
            android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::gameBack);
        audioManager = (AudioManager)getSystemService(AUDIO_SERVICE);
        audioFocus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener(change -> {
                focused = change == AudioManager.AUDIOFOCUS_GAIN;
                notifyForeground();
            }).build();
        game.loadUrl("https://"+HOST+"/assets/index.html");
    }

    private static boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),
            new ByteArrayInputStream("Offline game asset not found".getBytes(StandardCharsets.UTF_8)));
    }
    private static String mime(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if(lower.endsWith(".html"))return "text/html";
        if(lower.endsWith(".js"))return "text/javascript";
        if(lower.endsWith(".css"))return "text/css";
        if(lower.endsWith(".json"))return "application/json";
        if(lower.endsWith(".png"))return "image/png";
        if(lower.endsWith(".svg"))return "image/svg+xml";
        if(lower.endsWith(".woff2"))return "font/woff2";
        return "application/octet-stream";
    }
    private void immersive() {
        if(Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if(controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            }
        } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    private void notifyForeground() {
        if(game != null && loaded) game.evaluateJavascript("window.dispatchEvent(new CustomEvent('ringrush-foreground',{detail:"+(foreground && focused)+"}))",null);
    }
    private void gameBack() {
        if(game != null && loaded) game.evaluateJavascript("window.dispatchEvent(new Event('ringrush-back'))",null);
        else finish();
    }
    @Override public void onBackPressed() { gameBack(); }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        immersive();
        if(game != null) { game.requestApplyInsets(); game.requestLayout(); game.invalidate(); }
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus); if(hasFocus) immersive();
    }
    @Override protected void onResume() {
        super.onResume(); foreground = true;
        if(game != null) game.onResume();
        if(audioManager != null) focused = audioManager.requestAudioFocus(audioFocus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        notifyForeground(); immersive();
    }
    @Override protected void onPause() {
        foreground = false; notifyForeground();
        if(game != null) game.onPause();
        if(audioManager != null) audioManager.abandonAudioFocusRequest(audioFocus);
        super.onPause();
    }
    @Override protected void onDestroy() {
        if(game != null) { game.removeJavascriptInterface("AndroidGame"); game.destroy(); game = null; }
        super.onDestroy();
    }
    public final class AndroidGame {
        @JavascriptInterface public boolean isNative() { return true; }
        @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
    }
}

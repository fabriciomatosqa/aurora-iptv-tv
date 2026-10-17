package br.com.auroraiptv.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;

// Trusted local origin only. Never add an arbitrary remote page to this WebView.
public class MainActivity extends Activity {
    private static final int PLAY_REQUEST = 300;
    private static final String HOME = "https://appassets.androidplatform.net/index.html";
    private WebView browser;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        browser = new WebView(this);
        browser.setBackgroundColor(0xff07111f);
        setContentView(browser);
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        browser.setWebChromeClient(new WebChromeClient());
        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOME.equals(request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        browser.addJavascriptInterface(new PlaybackBridge(), "AuroraNative");
        browser.loadUrl(HOME);
    }

    public final class PlaybackBridge {
        @JavascriptInterface public void play(String url, String title, String key, double resumeSeconds) {
            Uri uri;
            try { uri = Uri.parse(url); }
            catch (Exception ignored) { return; }
            String scheme = uri.getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                intent.putExtra("url", url);
                intent.putExtra("title", title);
                intent.putExtra("key", key);
                intent.putExtra("resumeMs", (long) (Math.max(0, Math.min(resumeSeconds, 360000)) * 1000));
                startActivityForResult(intent, PLAY_REQUEST);
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PLAY_REQUEST && data != null) {
            String key = data.getStringExtra("key");
            long position = data.getLongExtra("positionMs", 0L);
            boolean ended = data.getBooleanExtra("ended", false);
            String js = "window.auroraNativePlaybackEnded && window.auroraNativePlaybackEnded("
                + JSONObject.quote(key == null ? "" : key) + ","
                + Math.max(0L, position / 1000L) + ","
                + ended + ")";
            browser.evaluateJavascript(js, null);
        }
    }
    @Override public void onBackPressed() {
        browser.evaluateJavascript("window.auroraGoBack && window.auroraGoBack()", null);
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
    }
    @Override public void onDestroy() {
        browser.removeJavascriptInterface("AuroraNative");
        browser.destroy();
        super.onDestroy();
    }
}

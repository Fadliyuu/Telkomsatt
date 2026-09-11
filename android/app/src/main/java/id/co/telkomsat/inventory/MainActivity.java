package id.co.telkomsat.inventory;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.OutputStream;
import java.util.Collections;

public class MainActivity extends Activity {
    private static final int CAMERA = 10, PICK_FILE = 11, SAVE_FILE = 12;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout content;
    private String serverUrl;
    private PermissionRequest cameraRequest;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingDownload;
    private androidx.webkit.JavaScriptReplyProxy pushReply;

    private void replyPushToken() {
        androidx.webkit.JavaScriptReplyProxy reply = pushReply;
        pushReply = null;
        if (reply == null) return;
        if (!getSystemService(android.app.NotificationManager.class).areNotificationsEnabled()) {
            reply.postMessage("{\"error\":\"Izinkan notifikasi di pengaturan aplikasi.\"}");
            return;
        }
        com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (task.isSuccessful()) reply.postMessage("{\"token\":" + JSONObject.quote(task.getResult()) + "}");
            else reply.postMessage("{\"error\":\"Gagal menghubungkan layanan notifikasi. Coba lagi.\"}");
        });
    }

    private String notificationUrl(Intent intent) {
        String path = intent.getStringExtra("link");
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\")) return serverUrl;
        Uri target = Uri.parse(serverUrl).buildUpon().encodedPath(null).build();
        String url = target.toString().replaceAll("/+$", "") + path;
        return trusted(Uri.parse(url)) ? url : serverUrl;
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (web != null) web.loadUrl(notificationUrl(intent));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        InventoryMessagingService.createChannel(this);
        serverUrl = BuildConfig.WEB_URL.isEmpty()
                ? getPreferences(MODE_PRIVATE).getString("server", "") : BuildConfig.WEB_URL;
        if (serverUrl.isEmpty()) showSetup(); else openWeb();
    }

    private LinearLayout screen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFFFFFFF);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(root);
        root.requestApplyInsets();
        return root;
    }

    private void showSetup() {
        LinearLayout root = screen();
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        int gap = (int) (24 * getResources().getDisplayMetrics().density);
        form.setPadding(gap, gap, gap, gap);
        root.addView(form);
        TextView title = new TextView(this);
        title.setText("Telkomsat Inventaris");
        title.setTextSize(24);
        form.addView(title);
        TextView help = new TextView(this);
        help.setText("Masukkan alamat HTTPS server inventaris Anda. Alamat ini disimpan di perangkat.");
        form.addView(help);
        EditText input = new EditText(this);
        input.setHint("https://inventaris.perusahaan.co.id");
        input.setSingleLine(true);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        form.addView(input);
        Button connect = new Button(this);
        connect.setText("Hubungkan");
        form.addView(connect);
        connect.setOnClickListener(v -> {
            String candidate = input.getText().toString().trim();
            Uri uri = Uri.parse(candidate);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || candidate.matches(".*\\s.*")
                    || uri.getQuery() != null || uri.getFragment() != null
                    || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))) {
                input.setError("Gunakan alamat utama HTTPS, tanpa path, query, atau akun.");
                return;
            }
            serverUrl = candidate;
            getPreferences(MODE_PRIVATE).edit().putString("server", serverUrl).apply();
            openWeb();
        });
    }

    private boolean trusted(Uri uri) {
        Uri base = Uri.parse(serverUrl);
        return "https".equalsIgnoreCase(uri.getScheme())
                && base.getHost() != null && base.getHost().equalsIgnoreCase(uri.getHost())
                && (base.getPort() == -1 ? 443 : base.getPort()) == (uri.getPort() == -1 ? 443 : uri.getPort());
    }

    private void openWeb() {
        LinearLayout root = screen();
        if (BuildConfig.WEB_URL.isEmpty()) {
            Button settings = new Button(this);
            settings.setText("Server");
            settings.setOnClickListener(v -> new AlertDialog.Builder(this)
                    .setMessage("Ganti server dan hapus sesi login aplikasi ini?")
                    .setNegativeButton("Batal", null).setPositiveButton("Ganti", (d, which) -> {
                        disposeWeb();
                        WebStorage.getInstance().deleteAllData();
                        CookieManager.getInstance().removeAllCookies(done -> {
                            CookieManager.getInstance().flush();
                            getPreferences(MODE_PRIVATE).edit().remove("server").apply();
                            showSetup();
                        });
                    }).show());
            root.addView(settings);
        }
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 4));
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this);
        content.addView(web, new LinearLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (trusted(uri)) return false;
                if (request.isForMainFrame()) openExternal(uri);
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                if (trusted(Uri.parse(url))) installDownloadHook();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showLoadError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showLoadError();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!trusted(request.getOrigin()) || !java.util.Arrays.asList(request.getResources())
                            .contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (cameraRequest != null) cameraRequest.deny();
                        cameraRequest = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA);
                    }
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (cameraRequest == request) cameraRequest = null;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), PICK_FILE); }
                catch (android.content.ActivityNotFoundException e) {
                    fileCallback.onReceiveValue(null); fileCallback = null;
                    toast("Aplikasi pemilih file tidak tersedia.");
                }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Uri base = Uri.parse(serverUrl);
            String origin = "https://" + base.getEncodedAuthority();
            WebViewCompat.addWebMessageListener(web, "TelkomsatPush", Collections.singleton(origin),
                    (view, message, source, mainFrame, reply) -> {
                        if (!mainFrame || !trusted(source)) return;
                        pushReply = reply;
                        if (android.os.Build.VERSION.SDK_INT >= 33
                                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                                && message.getData() != null && message.getData().contains("enable")) {
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 13);
                        } else replyPushToken();
                    });
            WebViewCompat.addWebMessageListener(web, "TelkomsatFiles", Collections.singleton(origin),
                    (view, message, source, mainFrame, reply) -> {
                        if (!mainFrame || !trusted(source)) return;
                        try {
                            JSONObject data = new JSONObject(message.getData());
                            if ("print".equals(data.optString("action"))) { printPage(); return; }
                            if ("error".equals(data.optString("action"))) { toast("Ekspor gagal. Maksimum file 20 MB."); return; }
                            if (pendingDownload != null) { toast("Selesaikan penyimpanan file sebelumnya."); return; }
                            String encoded = data.getString("data");
                            if (encoded.length() > 28 * 1024 * 1024) { toast("Maksimum ekspor 20 MB."); return; }
                            pendingDownload = Base64.decode(encoded, Base64.DEFAULT);
                            Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                            save.addCategory(Intent.CATEGORY_OPENABLE);
                            save.setType(data.optString("mime", "application/octet-stream"));
                            save.putExtra(Intent.EXTRA_TITLE, data.optString("name", "laporan"));
                            startActivityForResult(save, SAVE_FILE);
                        } catch (Exception e) { pendingDownload = null; toast("File tidak dapat disimpan."); }
                    });
        }
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            Uri uri = Uri.parse(url);
            if (trusted(uri)) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(uri);
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) request.addRequestHeader("Cookie", cookies);
                    request.addRequestHeader("User-Agent", agent);
                    String name = URLUtil.guessFileName(url, disposition, mime);
                    request.setTitle(name);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    // App-specific external storage needs no broad storage permission on Android 8+.
                    request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
                    ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                    toast("Unduhan dimulai. Buka melalui notifikasi unduhan.");
                } catch (Exception e) { toast("Unduhan gagal dimulai."); }
            } else if ("blob".equals(uri.getScheme()) || "data".equals(uri.getScheme())) {
                toast("Unduhan ini tidak didukung WebView. Gunakan ekspor dari tombol laporan atau Cetak.");
            } else openExternal(uri);
        });
        web.loadUrl(notificationUrl(getIntent()));
    }

    private void installDownloadHook() {
        web.evaluateJavascript("(() => { if (window.__telkomsatFiles || !window.TelkomsatFiles) return;"
                + "window.__telkomsatFiles = true;"
                + "window.print = () => TelkomsatFiles.postMessage(JSON.stringify({action:'print'}));"
                + "const original = HTMLAnchorElement.prototype.dispatchEvent;"
                + "function save(a) { const url = a.href; if (!url || !(url.startsWith('blob:') || url.startsWith('data:'))) return false;"
                + "fetch(url).then(r=>r.blob()).then(b=>{if(b.size>20*1024*1024) throw Error('size');"
                + "const reader=new FileReader(); reader.onload=()=>TelkomsatFiles.postMessage(JSON.stringify({"
                + "name:a.download||'laporan',mime:b.type||'application/octet-stream',data:reader.result.split(',')[1]}));"
                + "reader.readAsDataURL(b);}).catch(()=>TelkomsatFiles.postMessage(JSON.stringify({action:'error'})));return true;}"
                + "HTMLAnchorElement.prototype.dispatchEvent=function(e){if(e.type==='click' && save(this))return true;return original.call(this,e);};"
                + "const click=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){if(!save(this))click.call(this);};"
                + "document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a');if(a&&save(a)){e.preventDefault();e.stopImmediatePropagation();}},true);"
                + "})();", null);
    }

    private void printPage() {
        if (web == null) return;
        ((PrintManager) getSystemService(PRINT_SERVICE)).print("Telkomsat Inventaris",
                web.createPrintDocumentAdapter("Telkomsat Inventaris"), null);
    }

    private void showLoadError() {
        new AlertDialog.Builder(this).setTitle("Server belum dapat dibuka")
                .setMessage("Periksa koneksi internet dan alamat server HTTPS. Server Next.js harus aktif.")
                .setPositiveButton("Coba lagi", (d, which) -> { if (web != null) web.loadUrl(serverUrl); })
                .setNegativeButton("Tutup", null).show();
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!("https".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme))) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (android.content.ActivityNotFoundException e) { toast("Tidak ada aplikasi untuk membuka tautan ini."); }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 13) replyPushToken();
        if (code == CAMERA && cameraRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else { cameraRequest.deny(); toast("Izin kamera diperlukan untuk scan QR."); }
            cameraRequest = null;
        }
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
        if (code == SAVE_FILE) {
            byte[] bytes = pendingDownload;
            pendingDownload = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                Uri target = data.getData();
                new Thread(() -> {
                    try (OutputStream output = getContentResolver().openOutputStream(target)) {
                        if (output == null) throw new java.io.IOException("No output stream");
                        output.write(bytes);
                        runOnUiThread(() -> toast("File berhasil disimpan."));
                    } catch (Exception e) { runOnUiThread(() -> toast("Gagal menyimpan file.")); }
                }).start();
            }
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onPause() {
        if (web != null) { web.onPause(); CookieManager.getInstance().flush(); }
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    private void disposeWeb() {
        if (cameraRequest != null) { cameraRequest.deny(); cameraRequest = null; }
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (web != null) { content.removeView(web); web.stopLoading(); web.destroy(); web = null; }
    }
    @Override protected void onDestroy() { disposeWeb(); super.onDestroy(); }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
}

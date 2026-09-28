package com.neoaitech.attend.parents;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private SharedPreferences prefs;

    public static final String DEFAULT_API_BASE_URL = "https://attendance.neoaitech.com";
    public static final String LOCAL_PORTAL_URL = "file:///android_asset/parent.html";
    private static final String PREF_SERVER_URL = "server_url";

    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (isGranted) {
                    Log.d(TAG, "Notification permission granted by user.");
                } else {
                    Log.w(TAG, "Notification permission denied by user.");
                }
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(AttendanceSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);

        webView = findViewById(R.id.webView);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);

        NotificationHelper.createNotificationChannel(this);
        checkNotificationPermission();
        scheduleBackgroundSync();

        configureWebView();

        // Hardware back button navigation
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        // Disable SwipeRefreshLayout pull-down gesture to prevent unwanted page reloads when scrolling down
        swipeRefresh.setEnabled(false);

        // Load the portal
        loadPortal();
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
    }

    private void scheduleBackgroundSync() {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest syncWork = new PeriodicWorkRequest.Builder(
                AttendanceSyncWorker.class,
                15,
                TimeUnit.MINUTES
        )
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "neoai_attendance_sync",
                ExistingPeriodicWorkPolicy.KEEP,
                syncWork
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " NeoAIParentsApp/1.0");

        // Native JavaScript bridge
        webView.addJavascriptInterface(new ParentAppNativeBridge(this), "NativeAppBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadUrl(LOCAL_PORTAL_URL);
                    Toast.makeText(MainActivity.this, "Loaded Parent Portal", Toast.LENGTH_SHORT).show();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress == 100) {
                    progressBar.setVisibility(View.GONE);
                } else {
                    progressBar.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    private void loadPortal() {
        // Dedicated Parent Portal only - loads instant bundled assets
        webView.loadUrl(LOCAL_PORTAL_URL);
    }

    public static class ParentAppNativeBridge {
        private final Context context;

        public ParentAppNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.0.0 (Native Android WorkManager Push Active)";
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void syncParentCredentials(String token, String serverUrl) {
            SharedPreferences prefs = context.getSharedPreferences(AttendanceSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString(AttendanceSyncWorker.KEY_TOKEN, token)
                    .putString(AttendanceSyncWorker.KEY_SERVER_URL, serverUrl)
                    .apply();

            // Trigger immediate one-time sync
            OneTimeWorkRequest oneTimeSync = new OneTimeWorkRequest.Builder(AttendanceSyncWorker.class).build();
            WorkManager.getInstance(context).enqueue(oneTimeSync);
            Log.d("NativeBridge", "Parent credentials synced to SharedPreferences and immediate sync triggered.");
        }

        @JavascriptInterface
        public void clearParentCredentials() {
            SharedPreferences prefs = context.getSharedPreferences(AttendanceSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .remove(AttendanceSyncWorker.KEY_TOKEN)
                    .apply();
            WorkManager.getInstance(context).cancelUniqueWork("neoai_attendance_sync");
            Log.d("NativeBridge", "Parent credentials cleared on sign out.");
        }

        @JavascriptInterface
        public void postNativeNotification(String title, String message, String status, int recordId) {
            NotificationHelper.showAttendanceNotification(context, title, message, status, recordId);
        }

        @JavascriptInterface
        public void triggerSyncNow() {
            OneTimeWorkRequest oneTimeSync = new OneTimeWorkRequest.Builder(AttendanceSyncWorker.class).build();
            WorkManager.getInstance(context).enqueue(oneTimeSync);
        }
    }
}

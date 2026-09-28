package com.neoaitech.attend.parents;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class AttendanceSyncWorker extends Worker {

    private static final String TAG = "AttendanceSyncWorker";
    public static final String PREFS_NAME = "neoai_parent_prefs";
    public static final String KEY_TOKEN = "parent_auth_token";
    public static final String KEY_SERVER_URL = "server_url";
    public static final String KEY_LAST_RECORD_ID = "last_synced_record_id";
    public static final String KEY_LAST_FREEZE_ID = "last_synced_freeze_id";

    public AttendanceSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String token = prefs.getString(KEY_TOKEN, null);
        String serverUrl = prefs.getString(KEY_SERVER_URL, MainActivity.DEFAULT_API_BASE_URL);
        int sinceId = prefs.getInt(KEY_LAST_RECORD_ID, 0);
        int sinceFreezeId = prefs.getInt(KEY_LAST_FREEZE_ID, 0);

        if (token == null || token.trim().isEmpty()) {
            Log.d(TAG, "No parent session token found. Skipping sync.");
            return Result.success();
        }

        // Clean base URL
        String baseUrl = serverUrl;
        if (baseUrl.endsWith("/parent") || baseUrl.endsWith("/parent/")) {
            baseUrl = baseUrl.replaceAll("/parent/?$", "");
        }
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        String syncEndpoint = baseUrl + "/api/parent/device-sync?since_id=" + sinceId + "&since_freeze_id=" + sinceFreezeId;
        Log.d(TAG, "Polling background sync: " + syncEndpoint);

        HttpURLConnection conn = null;
        try {
            URL url = new URL(syncEndpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                InputStream is = conn.getInputStream();
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONObject resp = new JSONObject(sb.toString());
                boolean hasNew = resp.optBoolean("has_new", false);
                int latestId = resp.optInt("latest_id", sinceId);
                int latestFreezeId = resp.optInt("latest_freeze_id", sinceFreezeId);
                JSONArray events = resp.optJSONArray("events");

                if (hasNew && events != null) {
                    for (int i = 0; i < events.length(); i++) {
                        JSONObject ev = events.getJSONObject(i);
                        String title = ev.optString("title", "NeoAI Attendance Alert");
                        String message = ev.optString("message", "Attendance activity recorded.");
                        String status = ev.optString("status", "PRESENT");
                        int recordId = ev.optInt("record_id", ev.optInt("freeze_id", (int) (System.currentTimeMillis() % 100000)));

                        NotificationHelper.showAttendanceNotification(context, title, message, status, recordId);
                    }
                }

                // Update bookmarks
                prefs.edit()
                        .putInt(KEY_LAST_RECORD_ID, latestId)
                        .putInt(KEY_LAST_FREEZE_ID, latestFreezeId)
                        .apply();

                Log.d(TAG, "Sync complete. Latest record: " + latestId + ", freeze: " + latestFreezeId + ", events: " + (events != null ? events.length() : 0));
                return Result.success();
            } else {
                Log.w(TAG, "Device sync failed with HTTP status: " + responseCode);
                return Result.retry();
            }
        } catch (Exception e) {
            Log.e(TAG, "Sync exception: " + e.getMessage(), e);
            return Result.retry();
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}

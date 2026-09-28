package com.neoaitech.attend.parents;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class NotificationHelper {

    public static final String CHANNEL_ID = "neoai_attendance_channel";
    public static final String CHANNEL_NAME = "Attendance & Security Alerts";
    public static final String CHANNEL_DESC = "Instant notifications when your ward's attendance is verified, absent, or academic status updates.";

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#6366F1"));
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 280, 140, 280});
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    public static void showAttendanceNotification(
            Context context,
            String title,
            String message,
            String status,
            int notificationId
    ) {
        createNotificationChannel(context);

        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("from_notification", true);
        intent.putExtra("status", status);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                notificationId != 0 ? notificationId : (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        int color = Color.parseColor("#6366F1"); // Default Indigo
        if (status != null) {
            String s = status.toUpperCase();
            if (s.contains("PRESENT") && !s.contains("EXTRA")) {
                color = Color.parseColor("#10B981"); // Emerald green
            } else if (s.contains("ABSENT")) {
                color = Color.parseColor("#EF4444"); // Red alert
            } else if (s.contains("EXTRA")) {
                color = Color.parseColor("#F59E0B"); // Amber bonus
            } else if (s.contains("FREEZE")) {
                color = Color.parseColor("#EA580C"); // Deep Orange warning
            }
        }

        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setColor(color)
                .setColorized(true)
                .setAutoCancel(true)
                .setSound(defaultSound)
                .setVibrate(new long[]{0, 280, 140, 280})
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(pendingIntent);

        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.notify(notificationId != 0 ? notificationId : (int) (System.currentTimeMillis() % 100000), builder.build());
        } catch (SecurityException ignored) {
            // Android 13+ permission may be denied by user
        }
    }
}

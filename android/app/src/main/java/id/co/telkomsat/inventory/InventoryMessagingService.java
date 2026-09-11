package id.co.telkomsat.inventory;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class InventoryMessagingService extends FirebaseMessagingService {
    public static void createChannel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("inventory_updates", "Pembaruan inventaris", NotificationManager.IMPORTANCE_HIGH));
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        createChannel(this);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return;
        RemoteMessage.Notification content = message.getNotification();
        if (content == null) return;
        String id = message.getData().get("notificationId");
        int notificationId = id == null ? (int) System.currentTimeMillis() : id.hashCode();
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("link", message.getData().get("link"));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, notificationId, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(notificationId, new Notification.Builder(this, "inventory_updates")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(content.getTitle()).setContentText(content.getBody())
                .setStyle(new Notification.BigTextStyle().bigText(content.getBody()))
                .setAutoCancel(true).setContentIntent(pending).build());
    }
}

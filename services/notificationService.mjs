import * as notificationRepository from "../repositories/notificationRepository.mjs";

export async function listNotifications(recipientId) {
  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.findNotificationsByRecipient(recipientId),
    notificationRepository.countUnreadNotifications(recipientId),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationsRead(recipientId) {
  await notificationRepository.markAllAsRead(recipientId);
  return { unreadCount: 0 };
}

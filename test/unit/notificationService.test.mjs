import { expect, test, vi } from "vitest";

vi.mock("../../repositories/notificationRepository.mjs", () => ({
  findNotificationsByRecipient: vi.fn().mockResolvedValue([{ id: 1 }]),
  countUnreadNotifications: vi.fn().mockResolvedValue(3),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
}));

import * as repo from "../../repositories/notificationRepository.mjs";
import * as service from "../../services/notificationService.mjs";

test("listNotifications returns rows and the unread count for the recipient", async () => {
  await expect(service.listNotifications("u1")).resolves.toEqual({
    notifications: [{ id: 1 }],
    unreadCount: 3,
  });
  expect(repo.findNotificationsByRecipient).toHaveBeenCalledWith("u1");
  expect(repo.countUnreadNotifications).toHaveBeenCalledWith("u1");
});

test("markNotificationsRead clears and reports zero unread", async () => {
  await expect(service.markNotificationsRead("u1")).resolves.toEqual({ unreadCount: 0 });
  expect(repo.markAllAsRead).toHaveBeenCalledWith("u1");
});

import { sendControllerError } from "../utils/httpError.mjs";
import * as notificationService from "../services/notificationService.mjs";

export async function listNotifications(req, res) {
  try {
    const result = await notificationService.listNotifications(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to load notifications");
  }
}

export async function markNotificationsRead(req, res) {
  try {
    const result = await notificationService.markNotificationsRead(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to update notifications");
  }
}

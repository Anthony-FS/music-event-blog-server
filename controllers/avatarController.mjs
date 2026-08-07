import * as avatarService from "../services/avatarService.mjs";
import { sendControllerError } from "../utils/httpError.mjs";

function getAccessToken(req) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" ? token : null;
}

export async function uploadAvatar(req, res) {
  try {
    const result = await avatarService.uploadAvatar(
      req.user.id,
      req.file,
      getAccessToken(req),
    );
    return res.status(201).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to upload the avatar");
  }
}

export async function deleteAvatar(req, res) {
  try {
    await avatarService.deleteAvatar(
      req.body.avatarUrl,
      getAccessToken(req),
    );
    return res.status(204).send();
  } catch (error) {
    return sendControllerError(res, error, "Unable to delete the avatar");
  }
}

import { HttpError } from "../utils/httpError.mjs";
import * as authService from "../services/authService.mjs";

function sendAuthError(res, error, fallbackMessage) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
}

export async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return sendAuthError(res, error, "An error occurred during registration");
  }
}

export async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return sendAuthError(res, error, "An error occurred during login");
  }
}

export async function getUser(req, res) {
  const token = req.headers.authorization?.split(" ")[1];

  try {
    const result = await authService.getUser(token);
    return res.status(200).json(result);
  } catch (error) {
    return sendAuthError(res, error, "Internal server error");
  }
}

export async function resetPassword(req, res) {
  const token = req.headers.authorization?.split(" ")[1];

  try {
    const result = await authService.resetPassword(token, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return sendAuthError(res, error, "Internal server error");
  }
}

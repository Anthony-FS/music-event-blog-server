import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { HttpError } from "../utils/httpError.mjs";
import getSupabaseAdmin from "../utils/supabaseAdmin.mjs";

const BUCKET_NAME = "avatar-images";

export async function uploadAvatar(userId, file, accessToken) {
  if (!file) {
    throw new HttpError(400, "Please select an image.");
  }

  const storageClient = getStorageClient(accessToken);
  const extension = getExtension(file.originalname, file.mimetype);
  const filePath = `${userId}/${Date.now()}-${randomUUID()}.${extension}`;
  const { error } = await storageClient.storage
    .from(BUCKET_NAME)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new HttpError(500, error.message);
  }

  const { data } = storageClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return {
    avatarUrl: data.publicUrl,
    path: filePath,
  };
}

export async function deleteAvatar(imageUrl, accessToken) {
  const filePath = getManagedAvatarPath(imageUrl);

  if (!filePath) {
    return;
  }

  const { error } = await getStorageClient(accessToken)
    .storage.from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    throw new HttpError(500, error.message);
  }
}

function getStorageClient(accessToken) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getSupabaseAdmin();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new HttpError(
      500,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required",
    );
  }

  if (!accessToken) {
    throw new HttpError(401, "Authentication is required");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function getExtension(filename, mimeType) {
  const fromName = filename?.split(".").pop()?.toLowerCase();

  if (fromName && fromName !== filename.toLowerCase()) {
    return fromName;
  }

  const mimeExtensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return mimeExtensions[mimeType] ?? "jpg";
}

function getManagedAvatarPath(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

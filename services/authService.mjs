import supabase from "../utils/supabase.mjs";
import { HttpError } from "../utils/httpError.mjs";
import * as userRepository from "../repositories/userRepository.mjs";

export async function register({ email, password, username, name }) {
  const existingUser = await userRepository.findUserByUsername(username);

  if (existingUser) {
    throw new HttpError(400, "This username is already taken");
  }

  const { data, error: supabaseError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (supabaseError) {
    if (supabaseError.code === "user_already_exists") {
      throw new HttpError(400, "User with this email already exists");
    }

    throw new HttpError(400, "Failed to create user. Please try again.");
  }

  const user = await userRepository.createUser({
    id: data.user.id,
    username,
    name,
    role: "user",
  });

  return {
    message: "User created successfully",
    user,
  };
}

export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (
      error.code === "invalid_credentials" ||
      error.message.includes("Invalid login credentials")
    ) {
      throw new HttpError(
        400,
        "Your password is incorrect or this email doesn't exist",
      );
    }

    throw new HttpError(400, error.message);
  }

  return {
    message: "Signed in successfully",
    access_token: data.session.access_token,
  };
}

export async function getUser(token) {
  if (!token) {
    throw new HttpError(401, "Unauthorized: Token missing");
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    throw new HttpError(401, "Unauthorized or token expired");
  }

  const dbUser = await userRepository.findUserById(data.user.id);

  return {
    id: data.user.id,
    email: data.user.email,
    username: dbUser.username,
    name: dbUser.name,
    role: dbUser.role,
    profilePic: dbUser.profile_pic,
  };
}

export async function resetPassword(token, { oldPassword, newPassword }) {
  if (!token) {
    throw new HttpError(401, "Unauthorized: Token missing");
  }

  if (!newPassword) {
    throw new HttpError(400, "New password is required");
  }

  const { data: userData } = await supabase.auth.getUser(token);
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: oldPassword,
  });

  if (loginError) {
    throw new HttpError(400, "Invalid old password");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new HttpError(400, error.message);
  }

  return { message: "Password updated successfully" };
}

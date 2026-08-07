import "dotenv/config";

import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import connectionPool from "../utils/db.mjs";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  await connectionPool.end();
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in the backend .env",
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const accountDefinitions = [
  {
    email: "maya.listener@example.com",
    name: "Maya Chen",
    username: "maya-listener",
  },
  {
    email: "jordan.listener@example.com",
    name: "Jordan Lee",
    username: "jordan-listener",
  },
];

const { data: usersData, error: usersError } =
  await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

if (usersError) {
  await connectionPool.end();
  throw new Error(usersError.message, { cause: usersError });
}

const credentials = [];

try {
  for (const account of accountDefinitions) {
    const password = createStrongPassword();
    const existingUser = usersData.users.find(
      (user) => user.email?.toLowerCase() === account.email,
    );
    let user;

    if (existingUser) {
      const { data, error } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            name: account.name,
            username: account.username,
          },
        });

      if (error) {
        throw new Error(error.message, { cause: error });
      }

      user = data.user;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: {
          name: account.name,
          username: account.username,
        },
      });

      if (error) {
        throw new Error(error.message, { cause: error });
      }

      user = data.user;
    }

    await connectionPool.query(
      `insert into public.profiles (id, name, username, role)
       values ($1, $2, $3, 'member')
       on conflict (id) do update
       set name = excluded.name,
           username = excluded.username,
           role = 'member'`,
      [user.id, account.name, account.username],
    );

    credentials.push({
      email: account.email,
      password,
      name: account.name,
      username: account.username,
      role: "member",
    });
  }

  const credentialsPath = new URL(
    "../mock-accounts.local.json",
    import.meta.url,
  );
  await writeFile(
    credentialsPath,
    `${JSON.stringify(credentials, null, 2)}\n`,
    "utf8",
  );
  console.log("Mock accounts provisioned. Credentials saved locally.");
} finally {
  await connectionPool.end();
}

function createStrongPassword() {
  return `Aa1!${randomBytes(18).toString("base64url")}`;
}

// Fake Supabase auth + profile lookup shared by the hermetic suites.
// Tokens: "admin-token" and "member-token"; anything else is rejected.
export const users = {
  "admin-token": { id: "admin-id", email: "admin@test.dev", role: "admin" },
  "member-token": { id: "member-id", email: "member@test.dev", role: "member" },
};

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export async function getUser(token) {
  const user = users[token];
  return user
    ? { data: { user: { id: user.id, email: user.email } }, error: null }
    : { data: { user: null }, error: { message: "Invalid JWT" } };
}

export async function findProfileRole(userId) {
  const user = Object.values(users).find((u) => u.id === userId);
  return user ? { role: user.role } : null;
}

// Pool double: connect() hands out a client whose query/release do nothing.
export function makePool() {
  const client = { query: async () => ({ rows: [] }), release: () => {} };
  return {
    connect: async () => client,
    query: async () => ({ rows: [] }),
    end: async () => {},
  };
}

import * as pg from "pg";
const { Pool } = pg;

const connectionPool = new Pool({
    connectionString: 
    "postgresql://postgres:supabase159963@db.oydwfktroppqjdwpbzpa.supabase.co:5432/postgres"
});

export default connectionPool;
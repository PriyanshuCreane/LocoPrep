const { neon } = require('@neondatabase/serverless');

const sql = neon("postgresql://neondb_owner:npg_ML8eybsNBSv7@ep-wandering-hat-atx4r302.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require");

async function run() {
  try {
    const res = await sql`SELECT id, email, password_hash FROM users`;
    console.table(res);
  } catch (err) {
    console.error(err);
  }
}

run();

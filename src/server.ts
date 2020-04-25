import { Pool, QueryConfig } from "pg";
const pool = new Pool({
  user: 'bot',
  host: 'localhost',
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: 5432,
})

export async function query<T>(query: string, ...params: any[]) {
  console.log("Querying: " + query );
  const result = await pool.query(query, params);
  console.log( JSON.stringify( result.rows ) );
  return result.rows.map(value => value as T);
}

export async function queryNoReturn(query: string, ...params: any[]) {
  console.log("Querying: " + query );
  await pool.query(query, params);
}

export async function transaction(queries: QueryConfig[]) {
  const queryReturns = []
  try {
    await pool.query('BEGIN')
    for (const q of queries) {
      queryReturns.push(await pool.query(q));
    }
    await pool.query('COMMIT')
  } catch (e) {
    await pool.query('ROLLBACK')
    throw e
  }
  return queryReturns;
}

import { Pool, QueryConfig, Connection, PoolConfig } from "pg";
console.log(process.env.DATABASE_URL)

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL
}
if (process.env.DATABASE_SSL != undefined)
  poolConfig.ssl = JSON.parse(process.env.DATABASE_SSL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
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

export async function beginTransaction() {
    await pool.query('BEGIN')
}

export async function commitTransaction() {
    await pool.query('COMMIT')
}

export async function rollbackTransaction() {
    await pool.query('ROLLBACK')
}

export async function transaction(queries: QueryConfig[]) {
  const queryReturns = []
  try {
    console.log( "Transaction begin...")
    await pool.query('BEGIN')
    for (const q of queries) {
      console.log("Querying: " + q.text );
      queryReturns.push(await pool.query(q));
    }
    await pool.query('COMMIT')
    console.log( "...transaction complete")

  } catch (e) {
    await pool.query('ROLLBACK')
    throw e
  }
  return queryReturns;
}

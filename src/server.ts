import { Pool, QueryConfig, PoolConfig, PoolClient } from "pg";
console.log(process.env.DB_HOST)

const poolConfig: PoolConfig = {
  port: +process.env.DB_PORT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

const pool = new Pool(poolConfig)

export async function query<T>( client: PoolClient, query: string, ...params: any[]) {
  console.log("Querying: " + query);
  let result;
  if ( client == undefined )
    result = await pool.query(query, params);
  else
    result = await client.query(query, params);
    
  return result.rows.map(value => value as T);
}

export async function queryNoReturn( client: PoolClient, query: string, ...params: any[]) {
  console.log("Querying: " + query);
  if (client == undefined)
    await pool.query(query, params);
  else
    await client.query(query, params);
}

export async function transactionCallback(runTransactionQueries: (client: PoolClient) => Promise<void> ) {
  const client = await pool.connect()
  try {
    console.log( "Transaction begin...")
    await client.query('BEGIN')
    await runTransactionQueries(client);
    await client.query('COMMIT')
    console.log( "...transaction complete")

  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function transaction(queries: QueryConfig[]) {
  const queryReturns = []
  const client = await pool.connect()
  try {
    console.log( "Transaction begin...")
    await client.query('BEGIN')
    for (const q of queries) {
      console.log("Querying: " + q.text );
      queryReturns.push(await client.query(q));
    }
    await client.query('COMMIT')
    console.log( "...transaction complete")

  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  return queryReturns;
}

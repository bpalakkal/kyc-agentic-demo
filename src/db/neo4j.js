/**
 * Neo4j driver — singleton connection for the Express server.
 *
 * Environment variables (set in .env locally, hosting dashboard in production)
 * ─────────────────────────────────────────────────────────────────────────────
 * NEO4J_URI      Bolt or Neo4j URI  e.g. neo4j+s://xxxxx.databases.neo4j.io
 * NEO4J_USER     Database username  (default: neo4j)
 * NEO4J_PASSWORD Database password
 *
 * Usage
 * ─────
 * import { runQuery, closeDriver } from './src/db/neo4j.js';
 *
 * const records = await runQuery(
 *   'MATCH (e:Entity) RETURN e.kycId AS kycId, e.name AS name LIMIT 25',
 *   {}
 * );
 */

import neo4j from 'neo4j-driver';

const {
  NEO4J_URI      = 'neo4j://localhost:7687',
  NEO4J_USER     = 'neo4j',
  NEO4J_PASSWORD = '',
} = process.env;

let _driver = null;

function getDriver() {
  if (!_driver) {
    _driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      { maxConnectionPoolSize: 10 }
    );
  }
  return _driver;
}

/**
 * Run a Cypher query and return plain JS objects for each record.
 * Field values are automatically unwrapped from Neo4j integer types.
 */
export async function runQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((rec) => {
      const obj = {};
      for (const key of rec.keys) {
        const val = rec.get(key);
        // Unwrap Neo4j Integer → JS number
        obj[key] = neo4j.isInt(val) ? val.toNumber() : val;
      }
      return obj;
    });
  } finally {
    await session.close();
  }
}

/** Call on server shutdown to cleanly release connections. */
export async function closeDriver() {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}

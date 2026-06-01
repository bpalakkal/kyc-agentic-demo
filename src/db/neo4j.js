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

const NEO4J_URI      = process.env.NEO4J_URI      ?? 'neo4j://localhost:7687';
const NEO4J_USER     = process.env.NEO4J_USER     ?? process.env.NEO4J_USERNAME ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? '';

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

function unwrapVal(v) {
  if (neo4j.isInt(v)) return v.toNumber();
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.low === 'number') return neo4j.int(v.low, v.high).toNumber();
  return v;
}

function unwrapProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props ?? {})) out[k] = unwrapVal(v);
  return out;
}

function isNode(v) {
  return v != null && typeof v === 'object' && Array.isArray(v.labels) && typeof v.elementId === 'string' && !('type' in v && 'startNodeElementId' in v);
}

function isRel(v) {
  return v != null && typeof v === 'object' && typeof v.type === 'string' && typeof v.startNodeElementId === 'string';
}

/**
 * Run a Cypher query and return Cytoscape-ready { nodes, edges }.
 * Handles OPTIONAL MATCH nulls safely.
 */
export async function runGraphQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    const nodeMap  = new Map(); // cyId  → node data
    const elemIdToCyId = new Map(); // elementId → cyId
    const edgeMap  = new Map(); // elementId → edge data

    for (const rec of result.records) {
      for (const key of rec.keys) {
        const val = rec.get(key);
        if (isNode(val)) {
          const props = unwrapProps(val.properties);
          const cyId = props.caseId ?? props.case_id ?? props.kycId ?? val.elementId;
          elemIdToCyId.set(val.elementId, cyId);
          if (!nodeMap.has(cyId)) nodeMap.set(cyId, { id: cyId, label: val.labels[0] ?? 'Node', ...props });
        }
      }
      for (const key of rec.keys) {
        const val = rec.get(key);
        if (isRel(val) && !edgeMap.has(val.elementId)) {
          const src = elemIdToCyId.get(val.startNodeElementId);
          const tgt = elemIdToCyId.get(val.endNodeElementId);
          if (src != null && tgt != null) {
            edgeMap.set(val.elementId, { id: val.elementId, source: src, target: tgt, label: val.type, ...unwrapProps(val.properties) });
          }
        }
      }
    }
    return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
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

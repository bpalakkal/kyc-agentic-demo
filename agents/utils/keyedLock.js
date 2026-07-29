/**
 * Serialize work that mutates the same logical record inside one server process.
 * The database allocator remains the cross-process authority; this lock also
 * protects deployments that have not yet applied the atomic allocator migration.
 */
const tails = new Map();

export async function withKeyedLock(key, task) {
  const previous = tails.get(key) ?? Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => gate);
  tails.set(key, tail);

  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}

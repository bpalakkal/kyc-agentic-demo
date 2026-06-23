/**
 * Merge AttributeOutput[] arrays from multiple sources into a single unified list.
 *
 * Strategy per attribute_name:
 *   - display_value  : first non-null value in source priority order
 *   - lineage        : union of all lineage entries (one per source)
 *   - confidence     : maximum across sources
 *   - flags          : OR across sources (if any source flags it, it stays flagged)
 *
 * Source priority is determined by the order of the sourceGroups array passed in.
 *
 * @param {Array<{ source: string, attrs: import('../../../types.js').AttributeOutput[] }>} sourceGroups
 * @returns {import('../../../types.js').AttributeOutput[]}
 */
export function mergeAttributeSources(sourceGroups) {
  // Map: attributeName → { primary, allLineage }
  const byName = new Map();

  for (const { attrs } of sourceGroups) {
    for (const attr of attrs) {
      if (!byName.has(attr.attributeName)) {
        // First (highest-priority) source sets the primary display value
        byName.set(attr.attributeName, {
          primary:    { ...attr },
          allLineage: [...(attr.lineage ?? [])],
        });
      } else {
        const entry = byName.get(attr.attributeName);
        // Append this source's lineage so the analyst can see all values
        entry.allLineage.push(...(attr.lineage ?? []));
        // OR boolean flags
        if (attr.idFlag)           entry.primary.idFlag           = true;
        if (attr.verificationFlag) entry.primary.verificationFlag = true;
        if (attr.exceptionFlag)    entry.primary.exceptionFlag    = true;
        // Keep highest confidence
        if ((attr.confidence ?? 0) > (entry.primary.confidence ?? 0)) {
          entry.primary.confidence = attr.confidence;
        }
      }
    }
  }

  return Array.from(byName.values()).map(({ primary, allLineage }) => ({
    ...primary,
    lineage: allLineage,
  }));
}

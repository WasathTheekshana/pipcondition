/** Generic Kahn's-algorithm topological sort over a set of named nodes with dependsOn edges. */
export function topologicalOrder(nodeIds: readonly string[], dependsOn: (id: string) => readonly string[]): { readonly order: readonly string[]; readonly cycle: boolean } {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const id of nodeIds) {
    for (const dep of dependsOn(id)) {
      if (!dependents.has(dep)) continue; // unknown deps are surfaced separately as diagnostics by the caller
      dependents.get(dep)!.push(id);
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
    }
  }

  const queue: string[] = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }

  return { order, cycle: order.length !== nodeIds.length };
}

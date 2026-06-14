export type TreeNodeRef = { id: string; parentId: string | null };

export function descendantIds(rootId: string, nodes: TreeNodeRef[]) {
  const byParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    byParent.set(node.parentId, [...(byParent.get(node.parentId) || []), node.id]);
  }
  const result: string[] = [];
  const queue = [...(byParent.get(rootId) || [])];
  while (queue.length) {
    const id = queue.shift()!;
    result.push(id);
    queue.push(...(byParent.get(id) || []));
  }
  return result;
}

export function activeNodeIds(nodes: Array<{ id: string; active: boolean }>) {
  return nodes.filter((node) => node.active).map((node) => node.id);
}

import type { Renderable } from "@opentui/core";
export function findDialog(root: Renderable): Renderable | undefined {
  if (root.id === "dialog-panel") return root;
  for (const child of root.getChildren()) {
    const found = findDialog(child);
    if (found) return found;
  }
  return undefined;
}
/** Scroll contents may exceed their viewport. Chrome and visible rows must not. */
export function dialogLayoutErrors(root: Renderable): string[] {
  const panel = findDialog(root);
  if (!panel) return ["Missing dialog panel"];
  const errors: string[] = [];
  const texts: Renderable[] = [];
  function walk(node: Renderable) {
    if (node.constructor.name.includes("ScrollBox")) return;
    if ("plainText" in node) {
      if (
        node.x < panel!.x ||
        node.x + node.width > panel!.x + panel!.width ||
        node.y < panel!.y ||
        node.y + node.height > panel!.y + panel!.height
      )
        errors.push(`Outside panel: ${(node as Renderable & { plainText: string }).plainText}`);
      if ("virtualLineCount" in node && Number(node.virtualLineCount) > node.height)
        errors.push(`Wrapped overflow: ${(node as Renderable & { plainText: string }).plainText}`);
      texts.push(node);
    }
    for (const child of node.getChildren()) walk(child);
  }
  walk(panel);
  for (let i = 0; i < texts.length; i += 1)
    for (const other of texts.slice(i + 1)) {
      const text = texts[i]!;
      if (
        text.width > 0 &&
        other.width > 0 &&
        text.x < other.x + other.width &&
        text.x + text.width > other.x &&
        text.y < other.y + other.height &&
        text.y + text.height > other.y
      )
        errors.push(`Text overlap at ${text.x},${text.y}`);
    }
  return errors;
}

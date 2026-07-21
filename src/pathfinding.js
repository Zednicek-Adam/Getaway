// Grid pathfinding — A* with a binary min-heap open set.

export class MinHeap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(node) {
        this.items.push(node);
        this.bubbleUp(this.items.length - 1);
    }

    pop() {
        const items = this.items;
        if (items.length === 0) return null;

        const top = items[0];
        const last = items.pop();
        if (items.length > 0) {
            items[0] = last;
            this.bubbleDown(0);
        }
        return top;
    }

    bubbleUp(index) {
        const items = this.items;
        const node = items[index];
        while (index > 0) {
            const parentIndex = (index - 1) >> 1;
            if (items[parentIndex].f <= node.f) break;
            items[index] = items[parentIndex];
            index = parentIndex;
        }
        items[index] = node;
    }

    bubbleDown(index) {
        const items = this.items;
        const length = items.length;
        const node = items[index];

        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;

            if (left < length && items[left].f < items[smallest].f) smallest = left;
            if (right < length && items[right].f < items[smallest].f) smallest = right;
            if (smallest === index) break;

            items[index] = items[smallest];
            items[smallest] = node;
            index = smallest;
        }
    }
}

// A* search on a 4-connected grid.
// isWalkable(x, y) => boolean decides traversability.
// Returns the path as [{x, y}, ...] EXCLUDING the start tile, or null if unreachable.
export function findPath(isWalkable, startX, startY, endX, endY, { maxNodes = 1000 } = {}) {
    const heap = new MinHeap();
    const nodes = new Map(); // "x,y" -> best-known node
    const closed = new Set();

    const startNode = {
        x: startX,
        y: startY,
        g: 0,
        h: Math.abs(startX - endX) + Math.abs(startY - endY),
        parent: null,
    };
    startNode.f = startNode.g + startNode.h;

    heap.push(startNode);
    nodes.set(`${startX},${startY}`, startNode);

    let expanded = 0;

    while (heap.size > 0 && expanded < maxNodes) {
        const current = heap.pop();
        const currentKey = `${current.x},${current.y}`;

        // Lazy deletion: skip stale heap entries superseded by a better g
        if (closed.has(currentKey)) continue;
        if (nodes.get(currentKey) !== current) continue;

        expanded++;

        if (current.x === endX && current.y === endY) {
            const path = [];
            let node = current;
            while (node.parent !== null) {
                path.push({ x: node.x, y: node.y });
                node = node.parent;
            }
            return path.reverse();
        }

        closed.add(currentKey);

        const neighbors = [
            { x: current.x, y: current.y - 1 },
            { x: current.x, y: current.y + 1 },
            { x: current.x - 1, y: current.y },
            { x: current.x + 1, y: current.y },
        ];

        for (let n of neighbors) {
            if (!isWalkable(n.x, n.y)) continue;

            const key = `${n.x},${n.y}`;
            if (closed.has(key)) continue;

            const tentativeG = current.g + 1;
            const existing = nodes.get(key);

            if (!existing || tentativeG < existing.g) {
                const neighborNode = {
                    x: n.x,
                    y: n.y,
                    g: tentativeG,
                    h: Math.abs(n.x - endX) + Math.abs(n.y - endY),
                    parent: current,
                };
                neighborNode.f = neighborNode.g + neighborNode.h;
                nodes.set(key, neighborNode);
                heap.push(neighborNode);
            }
        }
    }

    return null; // No path found (or node budget exhausted)
}

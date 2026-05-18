# Patching 1.5 — Hierarchical Left-to-Right Layout & Subsystem Grouping

This patch integrates clean, rank-ordered hierarchical Left-to-Right (`'LR'`) graph organization with the advanced visual subsystem coloring, focused selection highlights, and edge animation routines.

## Technical Patch Plan

### 1. Hierarchical Left-to-Right (Dagre) Layout
* **Action:** Replace the `d3-force` physics simulation in `layout.js` with the hierarchical graph ranking engine from `@dagrejs/dagre`.
* **Orientation:** Position nodes from Left to Right (`rankdir: 'LR'`) with a node separation of `50` pixels and rank separation of `100` pixels.
* **Benefits:** 
  * Establishes a highly structured, readable architecture representation resembling a call flow diagram (left to right).
  * Eliminates node overlapping and flat line alignment issues.

### 2. Multi-Cluster Elegant Grouping (Retained from 1.4)
* **Connected Components:** Partition nodes into independent clusters using Breadth-First Search (BFS) inside `layout.js`.
* **Color Assignment:** Assign each architectural cluster a unique vivid pastel/neon color from a curated palette:
  * *Cluster 0:* Neon Blue (`#1E90FF`)
  * *Cluster 1:* Emerald Green (`#00C853`)
  * *Cluster 2:* Indigo Purple (`#AA00FF`)
  * *Cluster 3:* Amber Gold (`#FF8C00`)
  * *Cluster 4:* Rose Pink (`#FF2E93`)
  * *Cluster 5:* Ocean Teal (`#00BFA5`)
  * *Cluster 6:* Coral Red (`#FF3D00`)
* **Styling Integration:** Set every node card's left border to its subsystem's unique `clusterColor` by default.

### 3. Focused Execution Highlights & Dimming (Retained from 1.4)
* **Parent Glowing Glows:** Apply glowing borders, glowing shadows, and radial backgrounds with `clusterColor` **only** to the selected parent node.
* **Relative Dimming:** When a node is selected:
  * The selected node and its direct children remain fully opaque (`1.0` opacity).
  * All unrelated nodes dim down to `0.35` opacity.
  * Outgoing edges from the selected parent light up in `clusterColor` and trigger a dot-flowing animation.
  * All unrelated edges dim to `0.1` opacity.

### 4. Verification and Infrastructure Integrity
* **Threaded local server** in `cli.py` (which fixes `Ctrl+C` stop on Windows) is fully preserved.
* **Elastic Spacing Slider** remains completely removed.

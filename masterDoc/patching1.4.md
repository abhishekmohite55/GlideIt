# Patching 1.4 — Multi-Cluster Coloring & Elastic Spacing Physics

## Technical Patch Plan

This patch introduces highly visual subsystem clustering, selective execution highlighting, and an interactive spring-back force control panel.

### 1. Multi-Cluster Elegant Architectural Grouping
* **Concept:** When a codebase has multiple independent clusters (connected components), we will mathematically detect them and color-code each architectural subsystem distinctly.
* **Implementation:**
  * In `layout.js`, run a Breadth-First Search (BFS) on all edges to partition the 230+ nodes into independent **connected components (architectural clusters)**.
  * Assign each cluster a unique, elegant pastel/neon color from a curated palette:
    * *Cluster 0:* Neon Blue (`#1E90FF`)
    * *Cluster 1:* Emerald Green (`#00C853`)
    * *Cluster 2:* Indigo Purple (`#AA00FF`)
    * *Cluster 3:* Amber Gold (`#FF8C00`)
    * *Cluster 4:* Rose Pink (`#FF2E93`)
    * *Cluster 5:* Ocean Teal (`#00BFA5`)
    * *Cluster 6:* Coral Red (`#FF3D00`)
  * Each node will receive its subsystem's unique `clusterColor` to style its cards, borders, and glows dynamically!

### 2. Focused Execution Paths (Focused Highlighting)
* **Node Styling:** Update `GlideNode.jsx` to render dynamic glowing border-left lines and subtle back-glowing backgrounds using the node's `clusterColor` **only** for the selected parent node. Child nodes do not receive this color styling (remaining in their default state).
* **Dynamic Highlight/Dimming:** When a node is clicked (selected):
  * The selected "parent" node receives its unique `clusterColor` glow and border, while its direct child nodes (and all other nodes) do not receive this color styling.
  * The selected "parent" node and its direct children remain fully opaque (`1.0` opacity) to keep the execution context clear, while all other unrelated nodes dim down to `0.35`.
  * The edges exiting the parent node light up in the subsystem's vivid `clusterColor` and **start animating (flowing dots/dashes)**. All other unrelated connection lines dim to `0.1` opacity.

### 3. Elastic Spacing Physics (Gravity Slider)
* **Slider Component (`ForceSlider`):** Create a floating control panel in the canvas top-right.
* **Control Scope:** Implement an elastic slider (`-400` to `+800`) linked to `chargeOffset`. Dragging stretches or compresses the node coordinates in real-time.
* **Rubber-Band Spring Back:** On release, a `requestAnimationFrame` interpolation smoothly snaps the slider and the graph positions back to `0` with a premium elastic bounce, returning the codebase to its optimal balanced layout.

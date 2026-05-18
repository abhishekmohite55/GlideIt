# Patching 1.3 — Organic Layout & Edge Routing

## Technical Patch Plan

This patch resolves the "flat line" layout, poor spacing, and overlapping orthogonal edges by completely overhauling the graph physics and routing.

### 1. Organic "Force-Directed" Layout
* **Issue:** Hierarchical layout (`dagre`) aligns nodes on strict rows/columns, causing unconnected nodes to form massive flat lines and creating uneven empty space.
* **Solution:** We will replace `dagre` with `d3-force` (a physics-based engine).
  * We will run a static physics simulation before rendering.
  * Connected nodes will be pulled together (like springs) toward the center (where the main module will naturally settle).
  * Nodes will repel each other strongly (`charge` and `collision` forces), which guarantees they will be **spread out** generously.
  * Unconnected nodes will organically float in a circular cloud around the main components, completely fixing the empty space and "flat line" issues.

### 2. Parallel Edge Routing & Fanning
* **Issue:** The current orthogonal edges (`smoothstep`) merge into a single thick line when traveling along the same grid axes, making it impossible to see individual connections.
* **Solution:** 
  * Switch the base edge type to curved (`bezier`) which naturally fans out from different angles in the new organic layout.
  * Implement a custom React Flow edge component (`ParallelBezierEdge`). When multiple edges exist between the exact same nodes (or run alongside each other), the custom edge will calculate an offset and draw them strictly **parallel to each other with a very thin gap**, allowing you to zoom in and see every individual line clearly.

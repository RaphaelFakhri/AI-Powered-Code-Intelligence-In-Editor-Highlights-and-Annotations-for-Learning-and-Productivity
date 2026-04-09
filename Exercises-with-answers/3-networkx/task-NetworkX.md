# NetworkX

In this task, we want to visualize Zachary's Karate Club social network with community detection, showing both the full network and an ego network side by side.

You have found code that creates a pretty similar output (see Start Output), but you want to create something like the Goal Output.

## Start Output

_(Run `networkx_task.py` to see the start output: two plots stacked vertically -- a full network missing some important nodes, and a small ego network. Communities are over-split, axis frames are visible.)_

## Goal Output

_(The goal output shows: two plots side by side -- the full network with ALL nodes visible (bridge nodes drawn larger in red), proper community coloring (~2-4 communities), and both plots without axis frames. The ego network is expanded to show 2-hop neighbors.)_

---

## Subtasks

To create the goal output, you have to do the following tasks.

Note:

- You do not need to produce the exact same node positions; the layout may vary slightly between runs.
- The important aspects are: correct community coloring, all nodes visible, proper layout, and clean presentation.

### Subtask 1:

**Draw the missing bridge nodes in the full network plot.**

High-centrality "bridge" nodes (those connecting communities) are currently not rendered. Add them to the plot with a larger size (500) and a distinct red color, so they stand out.

| Current                    | Goal                                |
| -------------------------- | ----------------------------------- |
| Bridge nodes are invisible | Bridge nodes drawn in red, size 500 |

---

### Subtask 2:

**Display the two plots side by side instead of stacked vertically.**

Currently the full network and ego network are in a 2-row, 1-column layout. Arrange them side by side (1 row, 2 columns) and adjust the figure size accordingly.

| Current                            | Goal                               |
| ---------------------------------- | ---------------------------------- |
| 2 rows x 1 column, figsize=(8, 18) | 1 row x 2 columns, figsize=(18, 8) |

---

### Subtask 3:

**Expand the ego network to show 2-hop neighbors.**

Currently the ego network of node 0 only shows direct neighbors (radius=1). Expand it to include neighbors-of-neighbors (radius=2) to reveal more of the local structure.

| Current                     | Goal                        |
| --------------------------- | --------------------------- |
| `ego_graph(G, 0, radius=1)` | `ego_graph(G, 0, radius=2)` |

---

### Subtask 4:

**Fix the community detection to produce meaningful communities.**

The current resolution parameter (5.0) is far too high, causing the algorithm to split the network into too many tiny communities. Lower it to produce the expected ~2-4 communities that match the known social structure.

| Current                             | Goal                                |
| ----------------------------------- | ----------------------------------- |
| `resolution=5.0` (~10+ communities) | `resolution=1.0` (~2-4 communities) |

Also, remove the axis frames from both plots (`axis("on")` -> `axis("off")`).

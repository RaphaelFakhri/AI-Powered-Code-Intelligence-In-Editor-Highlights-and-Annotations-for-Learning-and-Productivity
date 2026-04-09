# Solutions

## Seaborn Task

| Task | Subtask | Description                                   | Starter Code                                             | Solution                                                                                                       |
| ---- | ------- | --------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0    | 1       | Display the four plots in a 2x2 grid          | `plt.subplots(4, 1, figsize=(8, 24))` ... `ax = axes[i]` | `plt.subplots(2, 2, figsize=(14, 12))` ... `ax = axes[i // 2, i % 2]`                                          |
| 0    | 2       | Add inner box plots inside each violin        | `sns.violinplot(..., inner=None, ...)`                   | `sns.violinplot(..., inner="box", ...)`                                                                        |
| 0    | 3       | Overlay individual data points on the violins | _(no stripplot call)_                                    | Add: `sns.stripplot(data=subset, x="School", y="Score", color="black", size=3, alpha=0.4, jitter=True, ax=ax)` |
| 0    | 4       | Remove the left and bottom axis spines        | `sns.despine(left=False, bottom=False)`                  | `sns.despine(left=True, bottom=True)`                                                                          |

### Full solution diff for Seaborn:

**Subtask 1** -- Change layout from 4x1 to 2x2:

```python
# OLD:
fig, axes = plt.subplots(4, 1, figsize=(8, 24))
...
    ax = axes[i]

# NEW:
fig, axes = plt.subplots(2, 2, figsize=(14, 12))
...
    ax = axes[i // 2, i % 2]
```

**Subtask 2** -- Add inner box plots:

```python
# OLD:
sns.violinplot(data=subset, x="School", y="Score",
               palette=palette, inner=None,
               orient="v", ax=ax)

# NEW:
sns.violinplot(data=subset, x="School", y="Score",
               palette=palette, inner="box",
               orient="v", ax=ax)
```

**Subtask 3** -- Add strip plot overlay (add after the violinplot call):

```python
sns.stripplot(data=subset, x="School", y="Score",
              color="black", size=3, alpha=0.4,
              jitter=True, ax=ax)
```

**Subtask 4** -- Remove spines:

```python
# OLD:
sns.despine(left=False, bottom=False)

# NEW:
sns.despine(left=True, bottom=True)
```

---

## Pillow Task

| Task | Subtask | Description                          | Starter Code                                                 | Solution                          |
| ---- | ------- | ------------------------------------ | ------------------------------------------------------------ | --------------------------------- |
| 0    | 1       | Display the four cards in a 2x2 grid | `ncols = 1` / `nrows = 4`                                    | `ncols = 2` / `nrows = 2`         |
| 0    | 2       | Reduce border thickness              | `border_w = 8`                                               | `border_w = 2`                    |
| 0    | 3       | Fix card orientation (upside-down)   | `card = card.rotate(180)`                                    | Remove line (or `card.rotate(0)`) |
| 0    | 4       | Remove blur from final image         | `canvas = canvas.filter(ImageFilter.GaussianBlur(radius=3))` | Remove line                       |

### Full solution diff for Pillow:

**Subtask 1** -- Change layout from 4x1 to 2x2:

```python
# OLD:
ncols = 1
nrows = 4

# NEW:
ncols = 2
nrows = 2
```

**Subtask 2** -- Reduce border thickness:

```python
# OLD:
border_w = 8

# NEW:
border_w = 2
```

**Subtask 3** -- Fix card orientation (remove the rotation):

```python
# OLD:
    card = card.rotate(180)

# NEW:
    # (line removed)
```

**Subtask 4** -- Remove blur effect:

```python
# OLD:
canvas = canvas.filter(ImageFilter.GaussianBlur(radius=3))

# NEW:
# (line removed)
```

---

## NetworkX Task

| Task | Subtask | Description                                  | Starter Code                                                      | Solution                                                                                              |
| ---- | ------- | -------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0    | 1       | Draw the missing bridge nodes                | _(bridge_nodes not drawn)_                                        | Add: `nx.draw_networkx_nodes(G, pos, nodelist=bridge_nodes, node_color="red", node_size=500, ax=ax1)` |
| 0    | 2       | Display plots side by side                   | `plt.subplots(2, 1, figsize=(8, 18))`                             | `plt.subplots(1, 2, figsize=(18, 8))`                                                                 |
| 0    | 3       | Expand ego network radius                    | `nx.ego_graph(G, 0, radius=1)`                                    | `nx.ego_graph(G, 0, radius=2)`                                                                        |
| 0    | 4       | Fix community detection + remove axis frames | `louvain_communities(G, resolution=5.0, ...)` and `ax.axis("on")` | `louvain_communities(G, resolution=1.0, ...)` and `ax.axis("off")`                                    |

### Full solution diff for NetworkX:

**Subtask 1** -- Add bridge nodes to the plot (add after the `draw_networkx_nodes` call for regular_nodes):

```python
nx.draw_networkx_nodes(G, pos, nodelist=bridge_nodes,
                       node_color="red", node_size=500, ax=ax1)
```

**Subtask 2** -- Change layout from vertical to horizontal:

```python
# OLD:
fig, axes = plt.subplots(2, 1, figsize=(8, 18))

# NEW:
fig, axes = plt.subplots(1, 2, figsize=(18, 8))
```

**Subtask 3** -- Expand ego network:

```python
# OLD:
ego = nx.ego_graph(G, 0, radius=1)

# NEW:
ego = nx.ego_graph(G, 0, radius=2)
```

**Subtask 4** -- Fix community resolution and remove axis frames:

```python
# OLD:
communities = louvain_communities(G, resolution=5.0, seed=42)
...
ax1.axis("on")
...
ax2.axis("on")

# NEW:
communities = louvain_communities(G, resolution=1.0, seed=42)
...
ax1.axis("off")
...
ax2.axis("off")
```

import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from networkx.algorithms.community import louvain_communities

# === Build the graph ===
G = nx.karate_club_graph()

# === Community detection ===
# SOLVED Subtask 4: resolution=1.0 instead of 5.0
communities = louvain_communities(G, resolution=1.0, seed=42)
community_map = {}
for i, comm in enumerate(communities):
    for node in comm:
        community_map[node] = i

n_communities = len(communities)
cmap = plt.cm.Set2

# === Classify nodes by betweenness centrality ===
betweenness = nx.betweenness_centrality(G)
bridge_nodes = [n for n in G.nodes() if betweenness[n] > 0.05]
regular_nodes = [n for n in G.nodes() if betweenness[n] <= 0.05]

# === Ego network of node 0 (Mr. Hi) ===
# SOLVED Subtask 3: radius=2 instead of 1
ego = nx.ego_graph(G, 0, radius=2)

# === Layout ===
pos = nx.spring_layout(G, k=0.6, seed=42)

# === Plotting ===
# SOLVED Subtask 2: 1 row, 2 columns instead of 2 rows, 1 column
fig, axes = plt.subplots(1, 2, figsize=(18, 8))

# ------ Plot 1: Full network with communities ------
ax1 = axes[0]

regular_colors = [community_map[n] for n in regular_nodes]
nx.draw_networkx_nodes(G, pos, nodelist=regular_nodes,
                       node_color=regular_colors, cmap=cmap,
                       vmin=0, vmax=n_communities,
                       node_size=300, ax=ax1)

# SOLVED Subtask 1: draw bridge nodes in red
nx.draw_networkx_nodes(G, pos, nodelist=bridge_nodes,
                       node_color="red", node_size=500, ax=ax1)

nx.draw_networkx_edges(G, pos, alpha=0.3,
                       edge_color="gray", ax=ax1)

nx.draw_networkx_labels(G, pos, font_size=8,
                        font_color="black", ax=ax1)

ax1.set_title("Zachary's Karate Club - Community Structure",
              fontsize=14, fontweight="bold")
# SOLVED Subtask 4: axis off
ax1.axis("off")

# ------ Plot 2: Ego network of node 0 ------
ax2 = axes[1]

ego_pos = {n: pos[n] for n in ego.nodes()}
ego_colors = [community_map.get(n, 0) for n in ego.nodes()]

nx.draw_networkx_nodes(ego, ego_pos,
                       node_color=ego_colors, cmap=cmap,
                       vmin=0, vmax=n_communities,
                       node_size=400, ax=ax2)

nx.draw_networkx_edges(ego, ego_pos, alpha=0.5,
                       edge_color="gray", ax=ax2)

nx.draw_networkx_labels(ego, ego_pos, font_size=10,
                        font_color="black", ax=ax2)

ax2.set_title("Ego Network of Node 0 (Mr. Hi)",
              fontsize=14, fontweight="bold")
# SOLVED Subtask 4: axis off
ax2.axis("off")

plt.tight_layout()
plt.savefig("networkx_goal_output.png", dpi=150, bbox_inches="tight")
plt.show()

import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from networkx.algorithms.community import louvain_communities

G = nx.karate_club_graph()

communities = louvain_communities(G, resolution=5.0, seed=42)
community_map = {}
for i, comm in enumerate(communities):
    for node in comm:
        community_map[node] = i

n_communities = len(communities)
cmap = plt.cm.Set2

betweenness = nx.betweenness_centrality(G)
bridge_nodes = [n for n in G.nodes() if betweenness[n] > 0.05]
regular_nodes = [n for n in G.nodes() if betweenness[n] <= 0.05]

ego = nx.ego_graph(G, 0, radius=1)

pos = nx.spring_layout(G, k=0.6, seed=42)

fig, axes = plt.subplots(2, 1, figsize=(8, 18))

ax1 = axes[0]

regular_colors = [community_map[n] for n in regular_nodes]
nx.draw_networkx_nodes(G, pos, nodelist=regular_nodes,
                       node_color=regular_colors, cmap=cmap,
                       vmin=0, vmax=n_communities,
                       node_size=300, ax=ax1)

nx.draw_networkx_edges(G, pos, alpha=0.3,
                       edge_color="gray", ax=ax1)

nx.draw_networkx_labels(G, pos, font_size=8,
                        font_color="black", ax=ax1)

ax1.set_title("Zachary's Karate Club - Community Structure",
              fontsize=14, fontweight="bold")
ax1.axis("on")

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
ax2.axis("on")

plt.tight_layout()
plt.savefig("networkx_output.png", dpi=150, bbox_inches="tight")
plt.show()

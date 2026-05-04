import json
import networkx as nx
from networkx.readwrite import json_graph

def analyze_path():
    with open('graphify-out/graph.json') as f:
        data = json.load(f)
    
    G = json_graph.node_link_graph(data, edges='links')
    U = G.to_undirected()
    
    c16_nodes = [n for n, d in G.nodes(data=True) if d.get('community') == 16]
    c54_nodes = [n for n, d in G.nodes(data=True) if d.get('community') == 54]
    
    print(f"C16 nodes: {c16_nodes}")
    print(f"C54 nodes: {c54_nodes}")
    
    found = False
    for start_node in c16_nodes:
        for end_node in c54_nodes:
            try:
                path = nx.shortest_path(U, start_node, end_node)
                print(f"\nPath found from {G.nodes[start_node]['label']} to {G.nodes[end_node]['label']}:")
                for i in range(len(path)-1):
                    u, v = path[i], path[i+1]
                    edge_data = G.get_edge_data(u, v) or G.get_edge_data(v, u)
                    rel = edge_data.get('relation', 'connected') if edge_data else 'connected'
                    print(f"  {G.nodes[u]['label']} --[{rel}]--> {G.nodes[v]['label']}")
                found = True
                break
            except nx.NetworkXNoPath:
                continue
        if found: break
    
    if not found:
        print("\nNo path found between Community 16 and Community 54 in the current graph.")
        # Check for intermediate communities
        print("\nChecking for common neighbors...")
        c16_neighbors = set()
        for n in c16_nodes:
            c16_neighbors.update(U.neighbors(n))
        
        c54_neighbors = set()
        for n in c54_nodes:
            c54_neighbors.update(U.neighbors(n))
            
        common = c16_neighbors.intersection(c54_neighbors)
        if common:
            print(f"Common nodes connecting them: {[G.nodes[c]['label'] for c in common]}")
        else:
            print("No common neighbors found.")

if __name__ == "__main__":
    analyze_path()

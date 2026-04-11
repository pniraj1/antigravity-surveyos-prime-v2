import json
from pathlib import Path

def make_node(f):
    stem = Path(f).stem
    ftype = 'document' if (f.endswith('.md') or f.endswith('.txt')) else ('image' if f.endswith('.svg') else 'code')
    nid = f.replace('\\', '_').replace('/', '_').replace('.', '_').replace(' ', '_')
    return {
        'id': nid, 'label': stem, 'file_type': ftype, 'source_file': f,
        'source_location': None, 'source_url': None, 'captured_at': None,
        'author': None, 'contributor': None
    }

uncached = Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').strip().split('\n')
images = [f for f in uncached if f.endswith('.svg')]
non_images = [f for f in uncached if not f.endswith('.svg')]
chunks = [non_images[i:i+22] for i in range(0, len(non_images), 22)]
for img in images:
    chunks.append([img])

print(f'{len(chunks)} chunks to process')

for ci, chunk in enumerate(chunks):
    nodes = []
    edges = []
    for f in chunk:
        n = make_node(f)
        nodes.append(n)
        p = Path(f)
        if not p.exists():
            continue
        try:
            text = p.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
        lines = text.split('\n')
        if f.endswith(('.ts', '.tsx', '.js')):
            for line in lines[:60]:
                line = line.strip()
                if line.startswith('import') and 'from' in line:
                    parts = line.split('from')
                    if len(parts) >= 2:
                        src = parts[-1].strip().strip('"').strip("'").strip(';')
                        if src.startswith('@/') or src.startswith('./') or src.startswith('../'):
                            target_id = src.replace('@/', 'src_').replace('./', '').replace('../', '').replace('/', '_').replace('.', '_').replace('-', '_')
                            edges.append({
                                'source': n['id'], 'target': target_id,
                                'relation': 'references', 'confidence': 'EXTRACTED',
                                'confidence_score': 1.0, 'source_file': f,
                                'source_location': None, 'weight': 1.0
                            })
        # For doc files, extract headings as concept nodes
        if f.endswith('.md'):
            for line in lines:
                line = line.strip()
                if line.startswith('## ') or line.startswith('# '):
                    concept = line.lstrip('#').strip()
                    if concept:
                        cid = (n['id'] + '_' + concept.replace(' ', '_').replace('/', '_').replace('.', '_'))[:80]
                        nodes.append({
                            'id': cid, 'label': concept, 'file_type': 'document',
                            'source_file': f, 'source_location': None, 'source_url': None,
                            'captured_at': None, 'author': None, 'contributor': None
                        })
                        edges.append({
                            'source': n['id'], 'target': cid,
                            'relation': 'references', 'confidence': 'EXTRACTED',
                            'confidence_score': 1.0, 'source_file': f,
                            'source_location': None, 'weight': 1.0
                        })
    result = {'nodes': nodes, 'edges': edges, 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}
    out_path = f'graphify-out/.graphify_chunk_{ci+1}.json'
    Path(out_path).write_text(json.dumps(result), encoding='utf-8')
    print(f'Chunk {ci+1}: {len(nodes)} nodes, {len(edges)} edges -> .graphify_chunk_{ci+1}.json')

print('All chunks done')

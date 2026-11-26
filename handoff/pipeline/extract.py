import json, re, sys
nb=json.load(open(sys.argv[1]))
figs=[]
for i,c in enumerate(nb['cells']):
    for o in c.get('outputs',[]):
        h=o.get('data',{}).get('text/html')
        if not h: continue
        h=''.join(h)
        m=re.search(r'Plotly\.newPlot\(\s*"[^"]+",\s*(\[.*?\])\s*,\s*(\{.*?\})\s*,\s*\{"responsive"', h, re.S)
        if not m: continue
        try:
            data=json.loads(m.group(1)); layout=json.loads(m.group(2))
        except Exception as e:
            print(i,'parse fail',e); continue
        t=layout.get('title',{}); t=t.get('text') if isinstance(t,dict) else t
        print(i, len(figs), [ (d.get('type'), len(d.get('z',[]) or d.get('lat',[]) or d.get('x',[]) or [])) for d in data][:6], (t or '')[:140])
        figs.append({'cell':i,'data':data,'layout':layout})
json.dump(figs,open('work/figs.json','w'))

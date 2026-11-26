import zipfile, json, numpy as np, pandas as pd
from matplotlib.path import Path
BB=(4.48,100.98,4.82,101.32)
z=zipfile.ZipFile('mys_general_2020_csv.zip')
parts=[]
for ch in pd.read_csv(z.open('mys_general_2020.csv'),chunksize=3_000_000):
    ch.columns=['lon','lat','v']
    m=ch.lat.between(BB[0],BB[2])&ch.lon.between(BB[1],BB[3])
    if m.any(): parts.append(ch[m])
P=pd.concat(parts,ignore_index=True)
F=json.load(open('figs.json'))
bd=F[0]['data'][1]; rings=[[]]
for lo,la in zip(bd['lon'],bd['lat']):
    if lo is None: rings.append([]); continue
    rings[-1].append((la,lo))
inside=np.zeros(len(P),bool)
for r in rings:
    if len(r)>3: inside|=Path(np.array(r)).contains_points(P[['lat','lon']].values)
P=P[inside].reset_index(drop=True)
print('pixels in boundary',len(P),'sum v',P.v.sum())
np.savez('meta_ipoh.npz',lat=P.lat.values,lon=P.lon.values,v=P.v.values)

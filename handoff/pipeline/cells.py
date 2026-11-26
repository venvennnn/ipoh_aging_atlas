import json, numpy as np
from scipy.spatial import cKDTree
M=np.load('meta_ipoh.npz'); lat,lon,v=M['lat'],M['lon'],M['v']
D=json.load(open('ipoh_data.json')); H=D['hex']
KX=110.95; KY=110.574
hx=np.array([[h['lon']*KX,h['lat']*KY] for h in H]); px=np.c_[lon*KX,lat*KY]
_,hi=cKDTree(hx).query(px)
hp=np.array([h['pop'] for h in H],float); hpct=np.array([h['pct'] for h in H],float)
sv=np.bincount(hi,weights=v,minlength=len(H))
pop=v*np.where(sv[hi]>0,hp[hi]/np.where(sv[hi]>0,sv[hi],1),0)
p65=pop*hpct[hi]/100
print('pop',pop.sum().round(),'p65',p65.sum().round(), 'hex p65 sum',sum(h['p65'] for h in H))
# aggregate to 100 m cells
G=0.1
gx=np.floor(lon*KX/G).astype(int); gy=np.floor(lat*KY/G).astype(int)
key=gx.astype(np.int64)*100000+gy
u,inv=np.unique(key,return_inverse=True)
cp=np.bincount(inv,weights=pop); c65=np.bincount(inv,weights=p65)
clon=np.bincount(inv,weights=lon*pop)/np.maximum(cp,1e-9); clat=np.bincount(inv,weights=lat*pop)/np.maximum(cp,1e-9)
# cells with zero pop: use mean coords
cnt=np.bincount(inv); mlon=np.bincount(inv,weights=lon)/cnt; mlat=np.bincount(inv,weights=lat)/cnt
clon=np.where(cp>0,clon,mlon); clat=np.where(cp>0,clat,mlat)
chex=np.array([np.bincount(hi[inv==i]).argmax() if False else 0 for i in range(0)])
_,chex=cKDTree(hx).query(np.c_[clon*KX,clat*KY])
print('cells',len(u),'nonzero',(cp>0).sum())
np.savez('cells.npz',lon=clon,lat=clat,pop=cp,p65=c65,hex=chex)

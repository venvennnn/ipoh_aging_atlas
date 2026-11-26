import json, numpy as np
from scipy.spatial import cKDTree
C=np.load('cells.npz'); D=json.load(open('ipoh_data.json')); F=json.load(open('figs.json'))
KX,KY=110.95,110.574
cx=np.c_[C['lon']*KX,C['lat']*KY]; w=C['p65']; W=w.sum()
def dist(t):
    f=np.array([[p['lon']*KX,p['lat']*KY] for p in D['fac'][t]]); d,_=cKDTree(f).query(cx); return d
curves={t['name']:np.array(t['y']) for t in F[11]['data'] if t.get('mode')=='lines'}
mins=np.arange(0,121)
def cdf(tmin): 
    o=np.argsort(tmin); cs=np.cumsum(w[o])/W*100; return np.interp(mins, tmin[o], cs, left=0)
res={}
for typ,nm in [('clinic','Public clinic (KKM)'),('hospital','Hospital')]:
    d=dist(typ)
    yw=curves[nm+' · walking']; yd=curves[nm+' · driving']
    # walk: t = d*k/(0.9*60/1000) min  (0.054 km/min)
    best=min(((np.abs(cdf(d*k/0.054)[:61]-yw[:61]).mean(),k) for k in np.arange(1.0,2.5,0.01)))
    # drive: t = 2 + d*k/v ; fit effective straight-line speed s km/min
    bd=min(((np.abs(cdf(2+d/s)[:31]-yd[:31]).mean(),s) for s in np.arange(0.1,1.5,0.005)))
    res[typ]={'walk_k':round(best[1],3),'walk_mae':round(best[0],2),'drive_kmpm':round(bd[1],3),'drive_mae':round(bd[0],2)}
    m=cdf(d*best[1]/0.054); md=cdf(2+d/bd[1])
    print(typ,res[typ],'walk<=30 model',m[30].round(1),'routed',yw[30],'| drive<=10 model',md[10].round(1),'routed',yd[10])
json.dump(res,open('calib.json','w'))
# bus check: 400m along streets => straight 400/k
k=(res['clinic']['walk_k']+res['hospital']['walk_k'])/2
db=dist('bus'); print('k avg',k,'bus within 400m street-equiv', (w[db*k<=0.4].sum()/W*100).round(1),'(notebook 16%)', 'within 500m',(w[db*k<=0.5].sum()/W*100).round(1),'(23%)')
print('straight-line within 400m', (w[db<=0.4].sum()/W*100).round(1))

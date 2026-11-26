import json, numpy as np
from scipy.spatial import cKDTree
C=np.load('cells.npz'); D=json.load(open('ipoh_data.json')); F=json.load(open('figs.json'))
KX,KY=110.95,110.574
cx=np.c_[C['lon']*KX,C['lat']*KY]; w=C['p65']; W=w.sum()
curves={t['name']:np.array(t['y']) for t in F[11]['data'] if t.get('mode')=='lines'}
def dist(t):
    f=np.array([[p['lon']*KX,p['lat']*KY] for p in D['fac'][t]]); d,_=cKDTree(f).query(cx); return d
cal={'clinic':{'k':1.48,'s':0.34},'hospital':{'k':1.60,'s':0.405},'care':{'k':1.54,'s':0.3725},'bus':{'k':1.98,'s':None}}
def share(m): return round(float(w[m].sum()/W*100),1)
chk={}
for t in ['clinic','hospital','care']:
    d=dist(t); k=cal[t]['k']; s=cal[t]['s']
    wm=d*k/0.054; dm=2+d/s
    c={'walk':[share(wm<=x) for x in (15,30,45)],'drive':[share(dm<=x) for x in (5,10,15)]}
    if t!='care':
        nm={'clinic':'Public clinic (KKM)','hospital':'Hospital'}[t]
        c['walk_routed']=[round(float(curves[nm+' · walking'][x]),1) for x in (15,30,45)]
        c['drive_routed']=[round(float(curves[nm+' · driving'][x]),1) for x in (5,10,15)]
    chk[t]=c
db=dist('bus'); chk['bus']={'walk':[share(db*1.98<=0.4),share(db*1.98<=0.5)],'walk_routed':[16,23]}
print(json.dumps(chk))
out=dict(D)
out['v']=2
out['cells']={'lon':[round(float(x),5) for x in C['lon']],'lat':[round(float(x),5) for x in C['lat']],
  'p65':[round(float(x),2) for x in C['p65']],'pop':[round(float(x),1) for x in C['pop']],'hex':[int(x) for x in C['hex']]}
out['calib']={'walk_speed_km_per_min':0.054,'drive_access_min':2,'types':cal,'check':chk,
 'method':'Straight-line distance from each 100 m cell to the nearest facility, scaled by a street-detour factor k (walking at 0.9 m/s) or an effective straight-line driving speed s (km/min, plus 2 min access). k and s are fitted so the existing facilities reproduce the notebook’s street-routed results (curves in Part 2; bus stops: 16% within 400 m, 23% within 500 m). Care homes have no routed curve, so they use the mean of the clinic and hospital fits.'}
out['sources']={'population':'Meta High Resolution Population Density, Malaysia general 2020 (30 m), 127,465 pixels inside the Majlis Bandaraya Ipoh boundary, scaled per hexagon to the notebook’s 2026 totals','p65':'DOSM Census 2020 share aged 65+ per census area (Bandar areas estimated as in the notebook)','facilities':'OpenStreetMap + Healthsites.io + KKM list (notebook Part 2, 4, 6)'}
s=json.dumps(out,separators=(',',':'),ensure_ascii=False); open('ipoh_data_v2.json','w').write(s); print('KB',len(s)//1024)

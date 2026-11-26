import json, base64, math
F=json.load(open('work/figs.json'))
LON0,LON1,LAT0,LAT1=101.0,101.26,4.51,4.79
H=800; W=round(H*(LON1-LON0)*math.cos(math.radians(4.65))/(LAT1-LAT0))
def P(lon,lat): return ((lon-LON0)/(LON1-LON0)*W, (LAT1-lat)/(LAT1-LAT0)*H)
def path(ring, prec=1):
    out=[]; last=None
    for lon,lat in ring:
        x,y=P(lon,lat); s=f"{x:.{prec}f},{y:.{prec}f}"
        if s!=last: out.append(s); last=s
    return "M"+"L".join(out)+"Z"
# hexes
d0=F[0]['data'][0]; d1=F[1]['data'][0]; d2=F[2]['data'][0]
feat={f['id']:f for f in d0['geojson']['features']}
pct={loc:z for loc,z in zip(d2['locations'],d2['z'])}
# DUNs
d13=F[13]['data'][0]
dfeat={f['id']:f for f in d13['geojson']['features']}
duns=[]
for loc,z,cd in zip(d13['locations'],d13['z'],d13['customdata']):
    g=dfeat[loc]['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    duns.append({'key':loc,'name':cd[0].split(' ',1)[1],'code':cd[0].split(' ')[0],'income':z,'polys':[p[0] for p in polys]})
def pip(x,y,ring):
    c=False; n=len(ring)
    for i in range(n):
        x1,y1=ring[i]; x2,y2=ring[(i+1)%n]
        if (y1>y)!=(y2>y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
    return c
hexes=[]
for loc,cd in zip(d0['locations'],d0['customdata']):
    ring=feat[loc]['geometry']['coordinates'][0]
    lon=sum(p[0] for p in ring[:-1])/(len(ring)-1); lat=sum(p[1] for p in ring[:-1])/(len(ring)-1)
    dn=None
    for dd in duns:
        if any(pip(lon,lat,r) for r in dd['polys']): dn=dd['name']; break
    x,y=P(lon,lat)
    hexes.append({'id':loc,'d':path(ring),'x':round(x,1),'y':round(y,1),'lat':round(lat,5),'lon':round(lon,5),'pop':round(cd[1]),'p65':round(cd[2],1),'pct':round(pct.get(loc,0),2),'area':cd[0],'dun':dn})
print('hexes',len(hexes),'W',W,'no dun',sum(1 for h in hexes if not h['dun']),'p65 sum',round(sum(h['p65'] for h in hexes)))
bd=F[0]['data'][1]
# boundary may contain None separators
rings=[[]]
for lo,la in zip(bd['lon'],bd['lat']):
    if lo is None: rings.append([]); continue
    rings[-1].append((lo,la))
boundary=" ".join(path(r,1) for r in rings if len(r)>2)
dunout=[]
for dd in duns:
    inh=[h for h in hexes if h['dun']==dd['name']]
    sp=sum(h['p65'] for h in inh) or 1
    cx=sum(h['x']*h['p65'] for h in inh)/sp; cy=sum(h['y']*h['p65'] for h in inh)/sp
    dunout.append({'name':dd['name'],'code':dd['code'],'income':dd['income'],'d':" ".join(path(r,0) for r in dd['polys']),'x':round(cx),'y':round(cy)})
def facs(k,ti):
    t=F[k]['data'][ti]; out=[]
    for i,(la,lo) in enumerate(zip(t['lat'],t['lon'])):
        x,y=P(lo,la); nm=(t.get('text') or [''])[i] if t.get('text') else ''
        out.append({'n':nm.split(' · ')[0],'lat':la,'lon':lo,'x':round(x,1),'y':round(y,1)})
    return out
fac={'clinic':facs(4,1),'hospital':facs(5,1),'care':facs(19,1),'bus':facs(20,1)}
print({k:len(v) for k,v in fac.items()}, fac['hospital'][:2])
data={'W':W,'H':H,'bounds':[LON0,LAT0,LON1,LAT1],'boundary':boundary,'hex':hexes,'dun':dunout,'fac':fac}
s=json.dumps(data,separators=(',',':'),ensure_ascii=False)
open('work/ipoh_data.json','w').write(s); print('json KB',len(s)//1024)
# rasters
import os; os.makedirs('work/img',exist_ok=True)
names={4:'walk_clinic',5:'walk_hospital',6:'drive_clinic',7:'drive_hospital',10:'clinic_capacity',19:'walk_care',20:'walk_bus',21:'index',22:'d_money',23:'d_health',24:'d_care',25:'d_social',26:'d_access'}
for k,nm in names.items():
    L=F[k]['layout']['map']['layers'][0]; src=L['source']
    b=base64.b64decode(src.split(',',1)[1]); open(f'work/img/{nm}.png','wb').write(b)
    print(nm, L['coordinates'], len(b))

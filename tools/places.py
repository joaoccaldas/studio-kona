"""Resolve persistent real-place coordinates for KONA PlaceWorld.

Reads data/places_v2.json and writes data/place_geocodes_v2.json.
Existing explicit coordinates always win. Missing coordinates are geocoded once,
cached, and then committed so runtime never depends on a geocoding service.

Nominatim usage is intentionally serialized and identified. Review its current
usage policy before bulk expansion. For large island-wide imports, prefer an
offline OSM extract / local geocoder instead of repeated public requests.
"""
import json, os, time, urllib.parse, urllib.request

HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..'))
SRC=os.path.join(ROOT,'data','places_v2.json')
OUT=os.path.join(ROOT,'data','place_geocodes_v2.json')
UA='CaldasStudio-KonaPlaceWorld/2.0 (github.com/joaoccaldas/studio-kona)'

def geocode(address):
    q=urllib.parse.urlencode({'q':address,'format':'jsonv2','limit':1,'countrycodes':'us'})
    req=urllib.request.Request('https://nominatim.openstreetmap.org/search?'+q,headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=30) as r:
        data=json.load(r)
    if not data: return None
    return {'lat':float(data[0]['lat']),'lon':float(data[0]['lon']),'display_name':data[0].get('display_name'),'source':'nominatim_osm'}

def main():
    cfg=json.load(open(SRC,encoding='utf8'))
    old={}
    if os.path.exists(OUT):
        old={p['id']:p for p in json.load(open(OUT,encoding='utf8')).get('places',[])}
    result=[]
    for p in cfg['places']:
        q=dict(p)
        if 'lat' in q and 'lon' in q:
            q['geocode_status']='explicit'
        elif p['id'] in old and 'lat' in old[p['id']]:
            q.update({k:old[p['id']][k] for k in ('lat','lon','display_name') if k in old[p['id']]})
            q['geocode_status']='cached'
        else:
            g=geocode(p['address'])
            if g:
                q.update(g); q['geocode_status']='resolved'
            else:
                q['geocode_status']='unresolved'
            time.sleep(1.1)
        result.append(q)
    json.dump({'version':cfg['version'],'places':result},open(OUT,'w'),indent=2,ensure_ascii=False)
    print('resolved',sum('lat' in p for p in result),'of',len(result))

if __name__=='__main__': main()

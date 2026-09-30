"""Validate KONA Studio world registries without network access."""
import json, os, sys

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
files={
 'world':os.path.join(ROOT,'data','island_world_v2.json'),
 'places':os.path.join(ROOT,'data','places_v2.json'),
 'fidelity':os.path.join(ROOT,'data','render_fidelity_v1.json'),
 'sources':os.path.join(ROOT,'data','world_sources_v2.json')
}
errors=[]; warnings=[]
for k,p in files.items():
    if not os.path.exists(p): errors.append(f'missing {k}: {p}')
if errors:
    print('\n'.join(errors)); sys.exit(1)

world=json.load(open(files['world'],encoding='utf8'))
places=json.load(open(files['places'],encoding='utf8'))
fidelity=json.load(open(files['fidelity'],encoding='utf8'))
sources=json.load(open(files['sources'],encoding='utf8'))

def uniq(items,key,label):
    seen=set()
    for x in items:
        v=x.get(key)
        if not v: errors.append(f'{label}: missing {key}')
        elif v in seen: errors.append(f'{label}: duplicate {key}={v}')
        seen.add(v)

uniq(world.get('zones',[]),'id','zone')
uniq(places.get('places',[]),'id','place')
uniq(sources.get('sources',[]),'id','source')

valid_prio={'hero','high','medium'}
valid_cat={'meeting_point','park','shopping','bike_service','bike_rental','grocery','restaurant','cafe','hospital','medical','vehicle_service','shop'}
for p in places.get('places',[]):
    if p.get('priority') not in valid_prio: errors.append(f"place {p.get('id')}: invalid priority")
    if p.get('category') not in valid_cat: warnings.append(f"place {p.get('id')}: unknown category {p.get('category')}")
    if p.get('priority') in {'hero','high'} and not p.get('recipe'):
        errors.append(f"place {p.get('id')}: hero/high missing recipe")
    if 'lat' not in p or 'lon' not in p:
        warnings.append(f"place {p.get('id')}: coordinates unresolved, run tools/places.py")

tiers=fidelity.get('tiers',{})
for req in ('T0_hero','T1_high','T2_context','T3_landscape','T4_far'):
    if req not in tiers: errors.append(f'fidelity: missing tier {req}')

if not world.get('policy',{}).get('repo_boundary'):
    errors.append('world: repo boundary policy missing')
if not sources.get('rules'):
    errors.append('sources: provenance rules missing')

print(f"zones={len(world.get('zones',[]))} places={len(places.get('places',[]))} sources={len(sources.get('sources',[]))}")
for w in warnings: print('WARN',w)
if errors:
    for e in errors: print('ERROR',e)
    sys.exit(1)
print('WORLD_V2_VALIDATION_PASS')

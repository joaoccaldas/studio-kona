#!/usr/bin/env python3
"""Validate data/raceweek.json before it is copied into the test build."""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(HERE, '..', 'data', 'raceweek.json')
d = json.load(open(path))
err = []
places = d['places']
ids = []
for day in d['days']:
    if day['date'][:7] != '2026-10':
        err.append('date ' + day['date'])
    for ev in day.get('play') or []:
        ids.append(ev['id'])
        if not (0 <= ev['start'] < ev['end'] <= 24):
            err.append('hours ' + ev['id'])
        if ev['evidence'] not in ('P', 'M', 'F', 'I'):
            err.append('evidence ' + ev['id'])
        if ev['mode'] not in ('walk', 'swim'):
            err.append('mode ' + ev['id'])
        for c in ev['checks']:
            if c.get('type') == 'coffee':
                continue
            if c['place'] not in places:
                err.append('missing place ' + c['place'])
            if not (4 <= c['r'] <= 80):
                err.append('radius ' + ev['id'])
if len(ids) != len(set(ids)):
    err.append('duplicate play ids')
L = 0
alii = d['alii']
for a, b in zip(alii, alii[1:]):
    L += math.hypot(b[0] - a[0], b[1] - a[1])
miles = 2 * L / 1609.344
if not (1.5 <= miles <= 2.0):
    err.append(f'underpants round trip {miles:.2f} mi outside 1.5–2')
need = {'hoala', 'coffee', 'checkin', 'parade', 'village', 'underpants', 'welcome', 'bike', 'start'}
if set(ids) != need:
    err.append('play set ' + str(sorted(set(ids) ^ need)))
if err:
    print('\n'.join(err))
    sys.exit(1)
print(f'raceweek ok · {len(d["days"])} days · {len(ids)} plays · underpants {miles:.2f} mi round trip')

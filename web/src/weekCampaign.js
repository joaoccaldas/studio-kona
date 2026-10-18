// The playable week is the published 2–12 October 2026 schedule.
// Lessons are only facts already checked against the results table. No invented splits or gear.

const LESSON = {
  fri2: 'This race has been in Kailua-Kona since 1981. The first three editions, 1978 to 1980, were on Oʻahu.',
  sat3: 'Triathlon began at Mission Bay, San Diego, on 25 September 1974. The first Ironman was on Oʻahu on 18 February 1978, with 15 starters and 12 finishers.',
  sun4: 'The swim is 3.8 km in Kailua Bay. The women\'s Kona course record is 8:24:31, Lucy Charles-Barclay, 2023.',
  mon5: 'The Coffee Boat swim is the open-water rehearsal. The men\'s Kona course record is 7:35:53, Patrick Lange, 2024.',
  tue6: 'Paula Newby-Fraser holds the most world titles, eight. Dave Scott, Mark Allen and Natascha Badmann won six each.',
  wed7: 'Gear in the museum is shown only when a race-week source exists. Anything else stays marked in research.',
  thu8: 'In February 1982 Julie Moss collapsed near the finish on Aliʻi Drive and crawled home 29 seconds behind Kathleen McCartney.',
  fri9: 'Bike check-in is what opens the rest of the course: Hāwī and the Energy Lab stay closed until this is done.',
  sat10: 'From the published schedule: transition opens 4:30–6:15, pro women 6:30, para and handcycle 6:33, age group 6:38. Confirm the men\'s wave on the official page before race day. Women and men are both in Kona the same day for the first time since 2019.',
  sun11: 'The week ends with the banquet. The map you opened and the days you finished are the record of your week.',
  mon12: 'Monday is the volunteer mahalo. The island you unlocked stays on this device until a cloud save exists.',
};

function targetFor(ev, places) {
  const check = (ev.checks || []).find(c => c.place && places[c.place]);
  if (!check) return [2, 8];
  const p = places[check.place];
  return [p.x, p.y];
}

function stepsFor(day, places) {
  const fromPlay = [];
  for (const ev of day.play || []) {
    const checks = (ev.checks || []).filter(c => c.place && places[c.place]);
    const list = checks.length ? checks : [null];
    list.forEach((c, i) => {
      const p = c ? places[c.place] : places.pier;
      fromPlay.push({
        id: ev.id + (list.length > 1 ? '_' + c.id : ''),
        action: ev.title,
        text: ev.title + (ev.where ? ' · ' + ev.where : ''),
        target: [p.x, p.y],
        radius: c && c.r ? c.r : 18,
        beaconColor: 0xffcc33,
        note: ev.note || '',
      });
    });
  }
  if (fromPlay.length) return fromPlay;
  if (day.id === 'sat3') {
    return [
      { id: 'funrun', action: 'Go to the fun run', text: 'Kona Town Fun Run · Hale Hālāwai', target: [places.hale.x, places.hale.y], radius: 22, beaconColor: 0xffcc33 },
      { id: 'packet', action: 'Pick up your packet', text: 'Hoʻāla packet pick-up · King Kamehameha', target: [places.kbr.x, places.kbr.y], radius: 18, beaconColor: 0xffcc33 },
    ];
  }
  const pierDays = day.id === 'fri2';
  const p = pierDays ? places.pier : places.kbr_lot;
  const label = (day.also && day.also[0]) || day.short;
  return [{ id: day.id + '_meet', action: 'Be there', text: label, target: [p.x, p.y], radius: 20, beaconColor: 0xffcc33 }];
}

export async function applyOfficialWeek(quests, base) {
  const data = await (await fetch(base + 'raceweek.json')).json();
  const built = data.days.map((day, i) => ({
    id: day.id,
    dayNumber: i + 1,
    title: day.short + ' · ' + day.date.slice(8) + ' October',
    subtitle: day.date,
    description: (day.also || []).concat(LESSON[day.id] ? [LESSON[day.id]] : []).join(' '),
    lesson: LESSON[day.id] || '',
    startHour: (day.play && day.play[0] && day.play[0].start) || 8,
    cameraStart: null,
    steps: stepsFor(day, data.places),
  }));
  quests.splice(0, quests.length, ...built);
  return data;
}

export function courseOpen(completedDays) {
  return (completedDays || []).includes('fri9');
}

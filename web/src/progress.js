// One progression model for the whole Kona experience.
// Race-week days and their activities, optional daily challenges, Memory Echoes and Hawaiian heritage
// discoveries all feed the same unlocks: bikes you can view in the Canyon museum and paints you can use.
// Nothing here is a "score": it is what you have lived through this week.

// Museum exhibits keyed by exhibit year (see PIER_HERITAGE_BIKES).
export const BIKE_UNLOCKS = {
  '1982': { memory: '1982' },
  '1989': { memory: '1989' },
  '2023': { memory: '2023' },
  '2018': { memory: '2018' },
  '2019': { challenge: 'fri2' },           // the one sourced bike, after the arrival ride
  '2004': { heritage: 2 },
  '2007': { heritage: 5 },
};

// Frame paints in the Canyon studio.
export const COLOUR_UNLOCKS = {
  '#ffcc33': { start: true },              // Kona Gold
  '#0a101d': { start: true },              // Stealth Carbon
  '#ffffff': { start: true },              // Arctic White
  '#e62233': { challenge: 'fri2' },        // Flash Coral — arrival ride
  '#00d2ff': { challenge: 'sun4' },        // Pacific Cyan — bay swim
  '#bde9d9': { challenge: 'mon5' },        // Canyon Mint — rehearsal ride
  '#2a9d8f': { heritage: 12 },             // Island Sage: every heritage site
};

// Official week. Medals are earned by being out on the island. No purchase path.
export const OFFICIAL_CHALLENGES = {
  fri2: { text: 'Level 1 · Ride 8 km south from KOA toward the pier.', metric: 'ride_m', target: 8000, reward: 'Flash Coral paint' },
  sat3: { text: 'Level 2 · Walk 1.5 km. The town fun run meets at Hale Hālāwai; this shakeout is your own.', metric: 'walk_m', target: 1500, reward: 'the shakeout logged on this device' },
  sun4: { text: 'Level 3 · Swim 200 m in Kailua Bay. The race swim is 3.8 km.', metric: 'swim_m', target: 200, reward: 'Pacific Cyan paint' },
  mon5: { text: 'Level 4 · Ride 5 km. The Coffee Boat swim is the open-water rehearsal.', metric: 'ride_m', target: 5000, reward: 'Canyon Mint paint' },
  fri9: { text: 'Level 5 · Ride 12 km before bike check-in. Hāwī and the Energy Lab open when that check-in is done.', metric: 'ride_m', target: 12000, reward: 'the long ride logged on this device' },
};

// Retired six-day script. Kept so an old save still resolves if the week file fails to load.
export const DAILY_CHALLENGES = {
  day1: { text: 'Walk 1 km around Kailua town and the seawall', metric: 'walk_m', target: 1000, reward: 'Flash Coral paint' },
  day2: { text: 'Ride 5 km out toward the Queen K', metric: 'ride_m', target: 5000, reward: 'the 2005 Speedmax exhibit' },
  day3: { text: 'Swim 400 m in Kailua Bay', metric: 'swim_m', target: 400, reward: 'Pacific Cyan paint' },
  day4: { text: 'Discover a Hawaiian heritage site today', metric: 'heritage', target: 1, reward: 'the 2011 Speedmax exhibit' },
  day5: { text: 'Ride 10 km: the last spin before race day', metric: 'ride_m', target: 10000, reward: 'Canyon Mint paint' },
  day6: { text: 'Walk 1 km of Aliʻi Drive with the crowds', metric: 'walk_m', target: 1000, reward: 'a finisher’s lei in your museum' },
};

const DAY_OF_MEMORY = { '1982': 1, '1989': 2, '2023': 3, '2018': 4, '2019': 5, '2026': 6 };

export function createProgress(saveData, { heritage, save, toast, quests }) {
  saveData.stats = saveData.stats || { walk_m: 0, ride_m: 0, swim_m: 0 };
  saveData.challenges = saveData.challenges || {};       // dayId -> { value, done, heritageStart }
  saveData.discoveredMemories = saveData.discoveredMemories || [];

  const heritageFound = () => (heritage && heritage() ? heritage().found : 0);

  function challengeDef(dayId) {
    return OFFICIAL_CHALLENGES[dayId] || DAILY_CHALLENGES[dayId] || null;
  }

  function met(req) {
    if (!req) return false;
    if (req.start) return true;
    if (req.memory) return saveData.discoveredMemories.includes(req.memory);
    if (req.heritage) return heritageFound() >= req.heritage;
    if (req.challenge) return !!(saveData.challenges[req.challenge] && saveData.challenges[req.challenge].done);
    return false;
  }
  function hint(req) {
    if (!req) return 'Not yet in the collection';
    if (req.memory) return `Relive the ${req.memory} memory (Day ${DAY_OF_MEMORY[req.memory] || '?'})`;
    if (req.heritage) return `Discover ${req.heritage} Hawaiian heritage site${req.heritage > 1 ? 's' : ''} (${Math.min(heritageFound(), req.heritage)}/${req.heritage})`;
    if (req.challenge) {
      const c = challengeDef(req.challenge);
      return c ? c.text : 'Finish the day’s challenge';
    }
    return '';
  }

  const api = {
    isBikeUnlocked: bike => met(BIKE_UNLOCKS[bike.year]),
    bikeHint: bike => hint(BIKE_UNLOCKS[bike.year]),
    isColourUnlocked: hex => met(COLOUR_UNLOCKS[(hex || '').toLowerCase()]) || !COLOUR_UNLOCKS[(hex || '').toLowerCase()],
    colourHint: hex => hint(COLOUR_UNLOCKS[(hex || '').toLowerCase()]),

    challengeFor(dayId) {
      const c = challengeDef(dayId);
      if (!c) return null;
      const st = saveData.challenges[dayId] || { value: 0, done: false };
      const value = c.metric === 'heritage' ? Math.max(0, heritageFound() - (st.heritageStart ?? heritageFound())) : st.value;
      return { ...c, value: Math.min(value, c.target), done: !!st.done };
    },

    // Called when a day becomes active so heritage challenges count finds made *that* day.
    beginDay(dayId) {
      const st = saveData.challenges[dayId] || (saveData.challenges[dayId] = { value: 0, done: false });
      if (st.heritageStart === undefined) st.heritageStart = heritageFound();
      save();
    },

    // metres travelled in a mode, attributed to lifetime stats and the active day's challenge
    track(metric, metres, dayId) {
      if (!(metres > 0)) return;
      saveData.stats[metric] = (saveData.stats[metric] || 0) + metres;
      const c = challengeDef(dayId);
      if (!c || c.metric !== metric) return;
      const st = saveData.challenges[dayId] || (saveData.challenges[dayId] = { value: 0, done: false });
      if (st.done) return;
      st.value += metres;
      if (st.value >= c.target) api.finish(dayId);
    },

    checkHeritage(dayId) {
      const c = challengeDef(dayId);
      if (!c || c.metric !== 'heritage') return;
      const st = saveData.challenges[dayId];
      if (st && !st.done && api.challengeFor(dayId).value >= c.target) api.finish(dayId);
    },

    finish(dayId) {
      const st = saveData.challenges[dayId] || (saveData.challenges[dayId] = { value: 0, done: false });
      if (st.done) return;
      st.done = true;
      const c = challengeDef(dayId);
      toast && toast(`Challenge complete. ${c.text} Unlocked ${c.reward}.`);
      save();
    },

    summary() {
      return {
        days: (saveData.completedDays || []).length, totalDays: quests.length,
        memories: saveData.discoveredMemories.length, totalMemories: Object.keys(DAY_OF_MEMORY).length,
        heritage: heritageFound(), totalHeritage: heritage && heritage() ? heritage().total : 12,
        challenges: Object.values(saveData.challenges).filter(c => c.done).length,
        totalChallenges: quests.filter(q => challengeDef(q.id)).length || Object.keys(OFFICIAL_CHALLENGES).length,
        stats: saveData.stats,
      };
    },
  };
  return api;
}

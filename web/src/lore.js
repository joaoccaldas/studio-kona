// The Kona Almanac and the Locker: what you learn and what you can wear, unlocked by coming back, moving around
// the island, playing, and finding hidden things. Pure data and rules (no DOM), unit-tested.
//
// An unlock rule is one of:
//   { days: n }        open the app on n different Hawaiʻi days      { streak: n }  an n-day streak
//   { walk: km }       walk km on the island                         { ride: km }   ride km on the island
//   { swim: m }        swim m in Kailua Bay                           { places: n }  discover n famous places
//   { place: id }      discover that place                            { egg: id }    find that easter egg
//   { eggs: n }        find n easter eggs                             { stars: n }   earn n Ride Map stars
//   { level: id, stars: n }  n stars on that level                    { rush: km }   ride km in one Kona Rush run
//   { cards: n }       collect n Almanac cards                         {} (always)

export const CATEGORIES = {
  race: { name: 'The Race', icon: '🏁' },
  tips: { name: 'Race Craft', icon: '🧠' },
  words: { name: 'ʻŌlelo Hawaiʻi', icon: '🌺' },
  culture: { name: 'Culture & Legends', icon: '🌋' },
  island: { name: 'The Island', icon: '🐢' },
  week: { name: 'Race Week', icon: '🎉' },
};

export const CARDS = [
  // The race
  { id: 'course', cat: 'race', title: 'Three legs, one day', text: '3.8 km swim in Kailua Bay, 180 km bike on the Queen Kaʻahumanu Highway to Hāwī and back, then a 42.2 km run through town, out the Queen K and into the Energy Lab.', unlock: {} },
  { id: 'swimstart', cat: 'race', title: 'Deep-water start', text: 'The swim starts in the water off Kailua Pier, next to Dig Me Beach. The course runs out along the coast to a turn boat and back to the pier stairs.', unlock: { swim: 50 } },
  { id: 'queenk', cat: 'race', title: 'The Queen K', text: 'The highway north from town crosses black lava fields that soak up the sun. Riders call the heat coming off the rock "the oven".', unlock: { ride: 2 } },
  { id: 'mumuku', cat: 'race', title: 'Mumuku winds', text: 'Near Kawaihae and the climb to Hāwī, gusty trade winds called mumuku funnel between the mountains and can push a rider sideways.', unlock: { level: 'crosswind', stars: 1 } },
  { id: 'energylab', cat: 'race', title: 'The Energy Lab', text: 'A loop out to Keāhole Point late in the marathon: no shade, no crowd, heat bouncing off the road. Many races are won or lost here.', unlock: { place: 'nelha' } },
  { id: 'palani', cat: 'race', title: 'Palani Hill', text: 'The short, steep climb from Aliʻi Drive up to the Queen K. On the run it comes after about 16 km, and it hurts.', unlock: { walk: 3 } },
  { id: 'midnight', cat: 'race', title: 'Until midnight', text: 'The finish line stays open until midnight, about 17 hours after the start. The last hour on Aliʻi Drive is famous for the loudest crowd of the day.', unlock: { place: 'finish' } },
  { id: 'history', cat: 'race', title: 'Why Kona?', text: 'The race began on Oʻahu in 1978 and moved to the Big Island in 1981. Kona has been the home of the long-distance world championship ever since.', unlock: { days: 2 } },
  { id: 'crawl', cat: 'race', title: 'The crawl of 1982', text: 'In 1982 Julie Moss collapsed metres from the finish and crawled across the line on live television. It inspired a generation to try the distance.', unlock: { days: 4 } },
  { id: 'ironwar', cat: 'race', title: 'Iron War', text: 'In 1989 Mark Allen and Dave Scott raced side by side for almost eight hours until Allen broke away on the last climb. Still called the greatest race.', unlock: { rush: 7.5 } },
  // Race craft
  { id: 'draft', cat: 'tips', title: 'The draft zone', text: 'On the bike you must keep a gap to the rider in front (12 m under the current long-distance rules) and complete a pass within about 25 seconds. Sitting in the zone earns a penalty.', unlock: { level: 'gap', stars: 1 } },
  { id: 'heat', cat: 'tips', title: 'Beat the heat', text: 'Put ice in your suit and hat, squeeze sponges on your neck, and drink at every aid station before you are thirsty. Heat slows everyone: pace for it.', unlock: { level: 'heat', stars: 1 } },
  { id: 'fuel', cat: 'tips', title: 'Eat on the bike', text: 'The bike leg is where you fuel for the marathon. Many athletes aim for 60 to 90 g of carbohydrate an hour, practised in training, never new on race day.', unlock: { ride: 10 } },
  { id: 'aid', cat: 'tips', title: 'Aid stations', text: 'On the run they come about every mile. Slow down to grab cleanly, say mahalo to the volunteers, and drop your trash before the end of the zone.', unlock: { level: 'handoff', stars: 1 } },
  { id: 'transition', cat: 'tips', title: 'Transition order', text: 'Helmet on and buckled before you touch the bike. Unrack, run it to the mount line and only climb on after it. Practise this: free time on race day.', unlock: { t1: true } },
  { id: 'flat', cat: 'tips', title: 'Fix it fast', text: 'Always check inside the tyre for the thorn or glass that caused the flat, or the new tube goes pop too. Carry a spare tube, levers and CO₂.', unlock: { level: 'flatfix', stars: 1 } },
  { id: 'descend', cat: 'tips', title: 'Descending Hāwī', text: 'Brake before the corner, not in it. Look where you want to go, keep your weight low, and watch for gusts where the road opens out.', unlock: { level: 'descent', stars: 1 } },
  { id: 'acclimate', cat: 'tips', title: 'Arrive early', text: 'Most athletes come a week or more before the race to get used to the heat and humidity, and to swim the course in the mornings.', unlock: { streak: 2 } },
  // Hawaiian words
  { id: 'w_aloha', cat: 'words', title: 'Aloha', text: 'Hello, goodbye, love and compassion, all in one word. "The aloha spirit" is a way of treating people.', unlock: {} },
  { id: 'w_mahalo', cat: 'words', title: 'Mahalo', text: 'Thank you. Say it to every volunteer at every aid station.', unlock: { days: 1 } },
  { id: 'w_honu', cat: 'words', title: 'Honu', text: 'The green sea turtle, a protected species and a symbol of good luck. Stay at least 3 m away, in the water and on the beach.', unlock: { place: 'kahaluu' } },
  { id: 'w_mauka', cat: 'words', title: 'Mauka and makai', text: 'Mauka means toward the mountain, makai toward the sea. Locals give directions this way instead of north or south.', unlock: { walk: 1 } },
  { id: 'w_ohana', cat: 'words', title: 'ʻOhana', text: 'Family, including the people who choose you. Race week in Kona feels like one big ʻohana.', unlock: { days: 3 } },
  { id: 'w_pau', cat: 'words', title: 'Pau', text: 'Finished, done. "Pau hana" is the end of the working day, and a good name for the moment you cross the line.', unlock: { stars: 8 } },
  { id: 'w_kokua', cat: 'words', title: 'Kōkua', text: 'Help, given freely. Thousands of volunteers give kōkua to make the race happen.', unlock: { level: 'handoff', stars: 2 } },
  { id: 'w_okina', cat: 'words', title: 'ʻOkina and kahakō', text: 'The ʻokina (ʻ) is a glottal stop and the kahakō (the line over ā) makes a vowel long. They change meaning, so Hawaiian place names are written with them.', unlock: { cards: 12 } },
  { id: 'w_ono', cat: 'words', title: 'ʻOno', text: 'Delicious. Also the name of a fast, tasty fish (wahoo) you will see on menus all over Kona.', unlock: { egg: 'shaveice' } },
  // Culture and legends
  { id: 'pele', cat: 'culture', title: 'Pele', text: 'The goddess of fire and volcanoes, who lives in Halemaʻumaʻu crater at Kīlauea. Many people leave offerings, and treat the lava as hers.', unlock: { place: 'kilauea' } },
  { id: 'pelecurse', cat: 'culture', title: 'Pele’s rocks', text: 'A popular story says taking lava rock home brings bad luck. Parks receive parcels of rocks mailed back by worried visitors every year. Leave them where they are.', unlock: { egg: 'rocks' } },
  { id: 'kamehameha', cat: 'culture', title: 'Kamehameha I', text: 'Born in North Kohala, he united the Hawaiian Islands by 1810 and spent his last years in Kailua, at Kamakahonu beside Ahuʻena Heiau.', unlock: { place: 'kamehameha' } },
  { id: 'heiau', cat: 'culture', title: 'Heiau', text: 'Temples of stone platforms and walls. They are sacred places: look, learn and do not climb on them or move the stones.', unlock: { place: 'ahuena' } },
  { id: 'refuge', cat: 'culture', title: 'Place of refuge', text: 'Anyone who broke a kapu, or warriors on the losing side, could be saved by reaching a puʻuhonua and being absolved by the priests.', unlock: { place: 'puuhonua' } },
  { id: 'menehune', cat: 'culture', title: 'The Menehune', text: 'Legendary little people who build fishponds and walls overnight, then vanish before dawn. If a job gets done while you sleep, blame the menehune.', unlock: { egg: 'menehune' } },
  { id: 'coral', cat: 'culture', title: 'Coral graffiti', text: 'Along the highways people spell names and messages with white coral on the black lava. The lava fields are full of them.', unlock: { egg: 'coral' } },
  { id: 'petroglyph', cat: 'culture', title: 'Kiʻi pōhaku', text: 'Petroglyphs carved into lava by early Hawaiians: people, canoes, turtles and circles, many along the ancient coastal trail.', unlock: { egg: 'petroglyph' } },
  { id: 'lei', cat: 'culture', title: 'Lei', text: 'A garland given with aloha, for arrivals, farewells and achievements. Never throw one away in front of the giver.', unlock: { places: 5 } },
  // The island
  { id: 'climates', cat: 'island', title: 'Every climate', text: 'Snow on Mauna Kea, rainforest at Hilo, desert lava at Kawaihae: the Big Island holds most of the world’s climate zones.', unlock: { place: 'maunakea' } },
  { id: 'tallest', cat: 'island', title: 'Taller than Everest', text: 'Measured from the sea floor, Mauna Kea is about 10,000 m tall, the tallest mountain on Earth.', unlock: { egg: 'snowman' } },
  { id: 'coffee', cat: 'island', title: 'Kona coffee', text: 'Grown only on a narrow belt of the Hualālai and Mauna Loa slopes, with sunny mornings, cloudy afternoons and volcanic soil.', unlock: { place: 'holualoa' } },
  { id: 'nene', cat: 'island', title: 'Nēnē', text: 'The Hawaiian goose, state bird of Hawaiʻi, brought back from near extinction. It walks on lava with half-webbed feet.', unlock: { egg: 'nene' } },
  { id: 'dolphins', cat: 'island', title: 'Spinner dolphins', text: 'They hunt offshore at night and rest in bays like Kealakekua by day. Give them space so they can sleep.', unlock: { level: 'honu', stars: 1 } },
  { id: 'whales', cat: 'island', title: 'Koholā', text: 'Humpback whales come to Hawaiʻi from about December to April to breed and give birth.', unlock: { level: 'honu', stars: 3 } },
  { id: 'poke', cat: 'island', title: 'Poke', text: 'Cubed raw fish with salt, seaweed and sesame: an everyday Hawaiian food and a favourite post-race recovery meal.', unlock: { streak: 3 } },
  { id: 'shaveice', cat: 'island', title: 'Shave ice', text: 'Ice shaved as fine as snow, soaked in fruit syrups. The best thing to eat after a hot training ride.', unlock: { egg: 'shaveice' } },
  // Race week
  { id: 'underpants', cat: 'week', title: 'The Underpants Run', text: 'On the Thursday of race week hundreds run down Aliʻi Drive in their underwear for charity, poking fun at the tiny race suits.', unlock: { egg: 'underpants' } },
  { id: 'coffeeboat', cat: 'week', title: 'The coffee boat', text: 'During race week a boat moored on the swim course serves coffee to swimmers treading water. Yes, really.', unlock: { egg: 'mug' } },
  { id: 'parade', cat: 'week', title: 'Parade of Nations', text: 'Athletes march down Aliʻi Drive behind their flags early in race week. More than 60 countries are usually represented.', unlock: { days: 5 } },
  { id: 'digme', cat: 'week', title: 'Dig Me Beach', text: 'The little beach beside the pier where everyone swims in the mornings of race week, and where everyone checks out everyone.', unlock: { swim: 200 } },
];

// Things to wear. slot: suit (pattern) | helmet | eyes | socks | extra | bike (frame colour)
export const COSMETICS = [
  { id: 'suit_solid', slot: 'suit', name: 'Race suit', unlock: {} },
  { id: 'suit_stripes', slot: 'suit', name: 'Kona stripes', unlock: { streak: 2 } },
  { id: 'suit_twotone', slot: 'suit', name: 'Two-tone', unlock: { stars: 3 } },
  { id: 'suit_wave', slot: 'suit', name: 'Ocean wave', unlock: { level: 'honu', stars: 2 } },
  { id: 'suit_floral', slot: 'suit', name: 'Aloha floral', unlock: { places: 5 } },
  { id: 'suit_lava', slot: 'suit', name: 'Lava flow', unlock: { rush: 7.5 } },
  { id: 'suit_sunrise', slot: 'suit', name: 'Kona sunrise', unlock: { stars: 18 } },
  { id: 'suit_underpants', slot: 'suit', name: 'Underpants Run', unlock: { egg: 'underpants' } },
  { id: 'helmet_aero', slot: 'helmet', name: 'Aero long-tail', unlock: {} },
  { id: 'helmet_road', slot: 'helmet', name: 'Road helmet', unlock: {} },
  { id: 'helmet_visor', slot: 'helmet', name: 'Run visor', unlock: { walk: 1 } },
  { id: 'helmet_cap', slot: 'helmet', name: 'Run cap', unlock: { days: 2 } },
  { id: 'helmet_swim', slot: 'helmet', name: 'Swim cap & goggles', unlock: { swim: 50 } },
  { id: 'helmet_crown', slot: 'helmet', name: 'Flower crown (lei poʻo)', unlock: { places: 8 } },
  { id: 'helmet_pineapple', slot: 'helmet', name: 'Pineapple', unlock: { eggs: 5 } },
  { id: 'eyes_shield', slot: 'eyes', name: 'Shield shades', unlock: {} },
  { id: 'eyes_round', slot: 'eyes', name: 'Round shades', unlock: { days: 3 } },
  { id: 'eyes_none', slot: 'eyes', name: 'No shades', unlock: {} },
  { id: 'eyes_star', slot: 'eyes', name: 'Star shades', unlock: { cards: 25 } },
  { id: 'socks_white', slot: 'socks', name: 'Race socks', unlock: {} },
  { id: 'socks_coral', slot: 'socks', name: 'Coral compression', unlock: { ride: 5 } },
  { id: 'socks_teal', slot: 'socks', name: 'Teal compression', unlock: { walk: 5 } },
  { id: 'extra_none', slot: 'extra', name: 'Nothing', unlock: {} },
  { id: 'extra_lei', slot: 'extra', name: 'Flower lei', unlock: { place: 'ahuena' } },
  { id: 'extra_medal', slot: 'extra', name: 'Finisher medal', unlock: { rush: 10 } },
  { id: 'extra_surf', slot: 'extra', name: 'Surfboard', unlock: { egg: 'surfboard' } },
  { id: 'extra_coffee', slot: 'extra', name: 'Coffee to go', unlock: { egg: 'mug' } },
  { id: 'bike_coral', slot: 'bike', name: 'Coral frame', unlock: {} },
  { id: 'bike_teal', slot: 'bike', name: 'Teal frame', unlock: {} },
  { id: 'bike_ink', slot: 'bike', name: 'Stealth ink', unlock: { ride: 3 } },
  { id: 'bike_gold', slot: 'bike', name: 'Gold frame', unlock: { stars: 24 } },
  { id: 'bike_lava', slot: 'bike', name: 'Lava frame', unlock: { eggs: 10 } },
];
export const DEFAULT_LOOK = { suit: 'suit_solid', helmet: 'helmet_aero', eyes: 'eyes_shield', socks: 'socks_white', extra: 'extra_none', bike: 'bike_coral' };

// The progress snapshot rules are checked against (built by the app from the save).
export function blankProgress() {
  return { days: 0, streak: 0, walkKm: 0, rideKm: 0, swimM: 0, places: [], eggs: [], levels: {}, rushKm: 0, t1: false, cards: 0 };
}
export function met(rule = {}, p) {
  if ('days' in rule) return p.days >= rule.days;
  if ('streak' in rule) return p.streak >= rule.streak;
  if ('walk' in rule) return p.walkKm >= rule.walk;
  if ('ride' in rule) return p.rideKm >= rule.ride;
  if ('swim' in rule) return p.swimM >= rule.swim;
  if ('places' in rule) return p.places.length >= rule.places;
  if ('place' in rule) return p.places.includes(rule.place);
  if ('eggs' in rule) return p.eggs.length >= rule.eggs;
  if ('egg' in rule) return p.eggs.includes(rule.egg);
  if ('level' in rule) return (p.levels?.[rule.level]?.stars || 0) >= (rule.stars || 1);
  if ('stars' in rule) return Object.values(p.levels || {}).reduce((a, l) => a + (l?.stars || 0), 0) >= rule.stars;
  if ('rush' in rule) return p.rushKm >= rule.rush;
  if ('t1' in rule) return !!p.t1;
  if ('cards' in rule) return p.cards >= rule.cards;
  return true;
}
// Unlocked cards; card-count rules are resolved after the others so "collect 12 cards" can open once 12 are in.
export function unlockedCards(p) {
  const base = CARDS.filter(c => !('cards' in c.unlock) && met(c.unlock, p)).map(c => c.id);
  const withCount = { ...p, cards: base.length };
  return CARDS.filter(c => met(c.unlock, withCount)).map(c => c.id);
}
export function unlockedCosmetics(p) {
  const cards = unlockedCards(p).length;
  return COSMETICS.filter(c => met(c.unlock, { ...p, cards })).map(c => c.id);
}
// A readable hint for a locked rule.
export function hint(rule = {}, names = {}) {
  if ('days' in rule) return `Open Kona on ${rule.days} different days`;
  if ('streak' in rule) return `Keep a ${rule.streak}-day streak`;
  if ('walk' in rule) return `Walk ${rule.walk} km on the island`;
  if ('ride' in rule) return `Ride ${rule.ride} km on the island`;
  if ('swim' in rule) return `Swim ${rule.swim} m in Kailua Bay`;
  if ('places' in rule) return `Discover ${rule.places} famous places`;
  if ('place' in rule) return `Discover ${names.places?.[rule.place] || 'a famous place'}`;
  if ('eggs' in rule) return `Find ${rule.eggs} hidden surprises`;
  if ('egg' in rule) return names.eggs?.[rule.egg] || 'Find a hidden surprise somewhere in Kona';
  if ('level' in rule) return `${rule.stars || 1}★ on ${names.levels?.[rule.level] || 'a Ride Map level'}`;
  if ('stars' in rule) return `Earn ${rule.stars} Ride Map stars`;
  if ('rush' in rule) return `Reach ${rule.rush} km in one Kona Rush`;
  if ('t1' in rule) return 'Finish Transition Tangle';
  if ('cards' in rule) return `Collect ${rule.cards} Almanac cards`;
  return 'Open';
}

export function validAlmanac(a) {
  const out = { eggs: [], seen: [], walkM: 0, rideM: 0, swimM: 0, look: { ...DEFAULT_LOOK } };
  if (!a || typeof a !== 'object') return out;
  const ids = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && ok(x)))] : []);
  const cardIds = new Set(CARDS.map(c => c.id).concat(COSMETICS.map(c => c.id)));
  out.eggs = ids(a.eggs, x => /^[a-z_]{2,20}$/.test(x));
  out.seen = ids(a.seen, x => cardIds.has(x));
  for (const k of ['walkM', 'rideM', 'swimM']) out[k] = Number.isFinite(a[k]) && a[k] >= 0 ? Math.min(a[k], 1e8) : 0;
  const look = a.look && typeof a.look === 'object' ? a.look : {};
  for (const slot of Object.keys(DEFAULT_LOOK)) if (COSMETICS.some(c => c.id === look[slot] && c.slot === slot)) out.look[slot] = look[slot];
  return out;
}

// Registry of the ride mini-games (level id → game module).
import handoff from './handoff.js';
import gap from './gap.js';
import crosswind from './crosswind.js';
import descent from './descent.js';
import honu from './honu.js';
import flatfix from './flatfix.js';
import heat from './heat.js';
import highfive from './highfive.js';

export const GAMES = { handoff, gap, crosswind, descent, honu, flatfix, heat, highfive };

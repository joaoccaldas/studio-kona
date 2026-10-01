// Modular Live Weather Service for Kona (PHKO) & General Aviation Stations
// Fetches real-time NOAA METAR observations and converts them into 3D vectors & atmosphere parameters.

export async function fetchStationWeather(stationId = 'PHKO') {
  const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(stationId)}&format=json`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`NOAA METAR HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Empty METAR response');
    const ob = data[0];

    const windDir = typeof ob.wdir === 'number' ? ob.wdir : 40;
    const windKts = typeof ob.wspd === 'number' ? ob.wspd : 8;
    const tempC = typeof ob.temp === 'number' ? ob.temp : 27;
    const dewpC = typeof ob.dewp === 'number' ? ob.dewp : 22;

    // Wind direction is reported as WHERE IT BLOWS FROM.
    // In physics/3D wind blows TOWARDS (windDir + 180).
    const blowTowardRad = ((windDir + 180) % 360) * Math.PI / 180;
    const windVec = {
      x: Math.sin(blowTowardRad),
      z: -Math.cos(blowTowardRad)
    };

    // Determine active runway for KOA based on headwind:
    // Runway 17: heading 174° mag. Runway 35: heading 354° mag.
    // If wind is from the North (300° to 080°), Runway 35 or 04 is favored.
    // Runway 17/35 in Kona: typically calm mornings use 17, trade winds or onshore breezes use 35 or 17.
    const diff17 = Math.abs(((windDir - 174 + 540) % 360) - 180);
    const diff35 = Math.abs(((windDir - 354 + 540) % 360) - 180);
    const activeRunway = diff17 < diff35 ? '17' : '35';

    const cloudBase = ob.clouds?.[0]?.base ?? 6000;

    return {
      ok: true,
      station: stationId,
      raw: ob.rawOb || `METAR ${stationId} ${windDir}${windKts}KT`,
      tempC,
      tempF: Math.round(tempC * 9 / 5 + 32),
      dewpointC: dewpC,
      windSpeedKnots: windKts,
      windSpeedMps: windKts * 0.514444,
      windDirectionDeg: windDir,
      windVector: windVec,
      activeRunway,
      visibilityMiles: typeof ob.visib === 'number' ? ob.visib : 10,
      flightCategory: ob.fltCat || 'VFR',
      cloudCeilingFt: cloudBase,
      timestamp: Date.now()
    };
  } catch (err) {
    // Graceful offline / fallback profile for Kona
    return {
      ok: false,
      error: err.message,
      station: stationId,
      raw: `METAR ${stationId} AUTO 04010KT 10SM CLR 28/22 A2992`,
      tempC: 28,
      tempF: 82,
      dewpointC: 22,
      windSpeedKnots: 10,
      windSpeedMps: 5.14,
      windDirectionDeg: 40,
      windVector: { x: -0.64, z: -0.76 },
      activeRunway: '35',
      visibilityMiles: 10,
      flightCategory: 'VFR',
      cloudCeilingFt: 6000,
      timestamp: Date.now()
    };
  }
}

export class LiveWeatherService {
  constructor({ station = 'PHKO', pollIntervalMs = 90000, onUpdate = null } = {}) {
    this.station = station;
    this.pollIntervalMs = pollIntervalMs;
    this.onUpdate = onUpdate;
    this.current = null;
    this.timer = null;
  }

  async start() {
    await this.poll();
    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
    }
    return this.current;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll() {
    const data = await fetchStationWeather(this.station);
    this.current = data;
    if (typeof this.onUpdate === 'function') {
      try { this.onUpdate(data); } catch (e) { console.warn('Weather onUpdate error:', e); }
    }
    return data;
  }
}

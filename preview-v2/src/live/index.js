// Kona Island Live Services Bundle
// Modular, exportable suite for real-time weather, airport flight schedules (FIDS), and live airspace tracking.

import { fetchStationWeather, LiveWeatherService } from './liveWeather.js';
import { generateKoaFlightSchedule, FidsBoardRenderer } from './liveFids.js';
import { fetchKoaAirspaceTransponders, LiveFlightController } from './liveFlights.js';

export { fetchStationWeather, LiveWeatherService };
export { generateKoaFlightSchedule, FidsBoardRenderer };
export { fetchKoaAirspaceTransponders, LiveFlightController };

export function createKoaLiveSuite({
  scene,
  THREE,
  W,
  toLocal,
  heightAt,
  onWeather = null,
  onFlights = null
} = {}) {
  const weather = new LiveWeatherService({
    station: 'PHKO',
    onUpdate: onWeather
  });

  const fids = new FidsBoardRenderer({
    width: 1024,
    height: 512,
    title: 'ELLISON ONIZUKA KONA INTERNATIONAL (KOA)'
  });

  const flights = new LiveFlightController({
    scene,
    THREE,
    W,
    toLocal,
    heightAt,
    onFlightStateChange: onFlights
  });

  return {
    weather,
    fids,
    flights,
    start() {
      weather.start();
      flights.start();
    },
    stop() {
      weather.stop();
      flights.stop();
    },
    update(dt) {
      const activeRunway = weather.current?.activeRunway || '17';
      flights.update(dt, activeRunway);
    }
  };
}

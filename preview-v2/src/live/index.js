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

      // Animate physical airport windsock to track real-time METAR wind direction & speed
      const windsock = scene.getObjectByName('koa_windsock_swivel');
      if (windsock && weather.current) {
        // Wind direction in METAR is direction FROM (e.g. 040° = from Northeast).
        // A windsock points DOWNWIND (the direction the air is moving toward):
        const blowTowardDeg = (weather.current.windDirectionDeg + 180) % 360;
        const targetRotY = -THREE.MathUtils.degToRad(blowTowardDeg) + Math.PI / 2;
        windsock.rotation.y = THREE.MathUtils.lerp(windsock.rotation.y, targetRotY, Math.min(1.0, dt * 2.5));

        // Cone droop vs stiffness based on wind speed:
        // At 0 kts: droops downward (-0.95 rad = ~55° droop).
        // At 15+ kts: flies fully straight/horizontal (-0.05 rad).
        const arm = windsock.getObjectByName('koa_windsock_cone_arm');
        if (arm) {
          const kts = weather.current.windSpeedKnots || 0;
          const stiffRatio = Math.min(1.0, Math.max(0, kts / 15.0));
          const targetTilt = THREE.MathUtils.lerp(-0.95, -0.05, stiffRatio);
          arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, targetTilt, Math.min(1.0, dt * 3.0));
        }
      }
    }
  };
}

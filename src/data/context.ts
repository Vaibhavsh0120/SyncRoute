/** Authored, reproducible environment context. No external service is required. */
export function getAreaContext(time: number) {
  const weather = time < 120 ? { condition: 'Clear', temperature: 28, rain: 0, speedFactor: 1 }
    : time < 360 ? { condition: 'Light rain', temperature: 25, rain: 1.2, speedFactor: .85 }
      : { condition: 'Cloudy', temperature: 26, rain: 0, speedFactor: 1 }
  return { weather, incident: time >= 180 && time < 420, ambulance: time >= 180, forecastSeconds: 30 }
}

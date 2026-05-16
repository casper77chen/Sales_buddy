async function getDistance(origin, destination) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn('未設定 GOOGLE_MAPS_API_KEY，使用模擬距離');
    return {
      distanceKm: 0,
      distanceText: '尚未設定 Google Maps API',
      durationText: '-',
    };
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${process.env.GOOGLE_MAPS_API_KEY}&language=zh-TW&mode=driving`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.rows[0] || !data.rows[0].elements[0] || data.rows[0].elements[0].status !== 'OK') {
    throw new Error('Google Maps API 無法計算此路線的距離');
  }

  const element = data.rows[0].elements[0];
  return {
    distanceKm: Math.round(element.distance.value / 100) / 10,
    distanceText: element.distance.text,
    durationText: element.duration.text,
  };
}

module.exports = { getDistance };

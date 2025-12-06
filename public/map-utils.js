export function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, points = [];

  while (index < str.length) {
    let b, shift = 0, result = 0;

    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0; result = 0;

    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lat * 1e-5, lng * 1e-5]);
  }

  return points;
}

export function drawPolylines(activities, canvas) {
  const ctx = canvas.getContext("2d");

  // Retina scaling
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  if (!activities.length) return;

  const paths = activities.map(a => decodePolyline(a.polyline));
  const flat = paths.flat();

  const lats = flat.map(p => p[0]);
  const lngs = flat.map(p => p[1]);

  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const pad = 30;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const scaleLng = w / Math.max(0.0001, maxLng - minLng);
  const scaleLat = h / Math.max(0.0001, maxLat - minLat);
  const scale = Math.min(scaleLng, scaleLat);

  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;

  paths.forEach((path, idx) => {
    ctx.beginPath();

    path.forEach((p, i) => {
      const x = pad + (p[1] - minLng) * scale;
      const y = pad + h - (p[0] - minLat) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = `hsl(${idx * 57 % 360}, 80%, 60%)`;
    ctx.stroke();
  });
}

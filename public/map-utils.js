// Import SDK modules (ES Modules)
import { Map, MapStyle, config, Language, NavigationControl, LngLatBounds } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

const ROUTE_SOURCE_ID = "strava-routes";
const ROUTE_LAYER_ID = "strava-routes-layer";
const DEFAULT_VIEW = { center: [0, 0], zoom: 1.5 };

let keyPromise;

/**
 * Decode Google-style polyline → array of [lat, lng]
 */
export function decodePolyline(str = "") {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points = [];

  while (index < str.length) {
    let b, shift = 0, result = 0;

    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lat * 1e-5, lng * 1e-5]);
  }

  return points;
}

/**
 * Fetch your MapTiler API key
 */
async function fetchMaptilerKey() {
  if (!keyPromise) {
    keyPromise = fetch("/api/maptiler-key")
      .then((res) => {
        if (!res.ok) throw new Error("Unable to fetch the MapTiler API key.");
        return res.json();
      })
      .then((payload) => {
        if (!payload?.key) throw new Error("MapTiler API key is not configured.");
        return payload.key;
      });
  }
  return keyPromise;
}

/**
 * Wait for map to finish loading
 */
function waitForMap(map) {
  if (map.loaded()) return Promise.resolve(map);
  return new Promise((resolve) => map.once("load", () => resolve(map)));
}

/**
 * Convert activities with polylines → GeoJSON FeatureCollection
 */
function createFeatureCollection(activities) {
  const features = activities
    .filter((activity) => Boolean(activity?.polyline))
    .map((activity, idx) => {
      const decoded = decodePolyline(activity.polyline)
        .map(([lat, lng]) => [lng, lat])  // Convert to [lng, lat]
        .filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));

      return decoded.length
        ? {
            type: "Feature",
            properties: {
              color: `hsl(${(idx * 57) % 360}, 70%, 55%)`
            },
            geometry: {
              type: "LineString",
              coordinates: decoded
            }
          }
        : null;
    })
    .filter(Boolean);

  return { type: "FeatureCollection", features };
}

/**
 * Auto-zoom map to fit all features
 */
function fitToFeatures(map, features) {
  if (!features.length) {
    map.easeTo({ center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, duration: 600 });
    return;
  }

  const bounds = features.reduce((acc, feature) => {
    feature.geometry.coordinates.forEach((coord) => acc.extend(coord));
    return acc;
  }, new LngLatBounds(
    features[0].geometry.coordinates[0],
    features[0].geometry.coordinates[0]
  ));

  map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 900 });
}

/**
 * Ensure a single shared layer exists
 */
function ensureLayer(map) {
  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#38acbd"],
        "line-width": 3,
        "line-opacity": 0.85
      }
    });
  }
}

/**
 * Update (or create) the shared GeoJSON source
 */
function updateSource(map, data) {
  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.getSource(ROUTE_SOURCE_ID).setData(data);
  } else {
    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data
    });
  }
}

/**
 * Initialize map using recommended MapTiler ES module API
 */
export async function initMap(container) {
  const apiKey = await fetchMaptilerKey();
  config.apiKey = apiKey;
  config.primaryLanguage = Language.ENGLISH;

  const map = new Map({
    container,
    style: MapStyle.STREETS,
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom
  });

  await waitForMap(map);

  map.addControl(new NavigationControl(), "top-right");

  return map;
}

/**
 * Render polyline activities on map (fully dynamic)
 */
export function renderPolylines(map, activities = []) {
  if (!map) return;

  const apply = () => {
    const collection = createFeatureCollection(activities);
    updateSource(map, collection);
    ensureLayer(map);
    fitToFeatures(map, collection.features);
  };

  if (map.loaded()) apply();
  else map.once("load", apply);
}

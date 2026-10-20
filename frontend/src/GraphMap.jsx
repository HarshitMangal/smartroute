// GraphMap.jsx
// Leaflet map pe graph nodes aur path visualize karta hai
//
// Map pe kya dikhta hai:
//   - Blue circles = graph nodes (fixed positions — real coords baad mein)
//   - Gray lines   = sab edges (roads)
//   - Green line   = shortest path found
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { VEHICLE_COLORS } from './VrpPanel';

function createVanIcon(color) {
  return L.divIcon({
    className: 'custom-van-marker',
    html: `<div style="
      background: ${color};
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 14px ${color}, 0 4px 8px rgba(0,0,0,0.6);
      border: 2px solid #ffffff;
      transform: translate(-18px, -18px);
      transition: all 0.1s linear;
    ">🚚</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// ─── Default Jodhpur Center Coordinates ──────────────────────────
const JODHPUR_COORDS = [26.2389, 73.0243]; // Clock Tower / Ghanta Ghar, Jodhpur

// ─── Map Click Listener Helper ───────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

// ─── Auto bounds fitter & pan helper ─────────────────────────────
function MapUpdater({ positions, center }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      map.invalidateSize();
      map.fitBounds(positions, { padding: [60, 60] });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [positions, center, map]);
  return null;
}

export default function GraphMap({
  nodes,
  edges,
  path,
  multiRoutes,
  liveVehicles,
  trafficMode,
  mstEdges,
  source,
  destination,
  highlightStops,
  customCoords,
  nodeLabels,
  onAddNodeAtCoords,
}) {
  const totalNodes = nodes || 6;
  const [center, setCenter] = useState(JODHPUR_COORDS);
  const [locationName, setLocationName] = useState('Jodhpur, Rajasthan');
  const [isLocating, setIsLocating] = useState(false);

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Stop #${id}`;
  }

  // Auto-detect browser live GPS location on mount
  useEffect(() => {
    detectLiveLocation();
  }, []);

  function detectLiveLocation() {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setCenter(coords);
        setLocationName('Your Live GPS Location 📍');
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS location permission denied/unavailable. Defaulting to Jodhpur:', err.message);
        setCenter(JODHPUR_COORDS);
        setLocationName('Jodhpur, Rajasthan (Default)');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Custom coordinates or generated positions around center
  const positions = Array.from({ length: totalNodes }, (_, i) => {
    if (customCoords && customCoords[i]) {
      return customCoords[i];
    }
    const [centerLat, centerLng] = center;
    const radius = 0.025;
    const angle = (2 * Math.PI * i) / totalNodes - Math.PI / 2;
    return [centerLat + radius * Math.cos(angle), centerLng + radius * Math.sin(angle)];
  });

  // Path edges — green line ke liye lat/lng array
  const pathLatLngs = path ? path.map(n => positions[n]) : [];

  return (
    <div className="map-container" style={{ height: '100%', width: '100%', flex: 1 }}>

      {/* Hint overlay with GPS button */}
      <div className="map-hint" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span>📍 {locationName} (Click map to add Stop)</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={detectLiveLocation}
          disabled={isLocating}
          style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
        >
          {isLocating ? '📡 Locating...' : '🎯 Track My GPS'}
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', minHeight: '100%' }}
        zoomControl={true}
      >
        <MapUpdater positions={positions} center={center} />
        <MapClickHandler onMapClick={onAddNodeAtCoords} />

        {/* OpenStreetMap tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap'
        />

        {/* ── All Edges (gray roads or red traffic jams) ─────── */}
        {edges && edges.map(([u, v, w], i) => {
          if (!positions[u] || !positions[v]) return null;
          const isCongested = trafficMode && (
            (u === 0 && v === 1) || (u === 1 && v === 0) ||
            (u === 1 && v === 2) || (u === 2 && v === 1) ||
            (u === 2 && v === 3) || (u === 3 && v === 2)
          );

          return (
            <Polyline
              key={`edge-${i}-${u}-${v}`}
              positions={[positions[u], positions[v]]}
              pathOptions={{
                color: isCongested ? '#ef4444' : '#64748b',
                weight: isCongested ? 5 : 3,
                opacity: isCongested ? 0.95 : 0.7,
                dashArray: isCongested ? '4 4' : '6 4',
              }}
            >
              <Tooltip sticky>
                {isCongested
                  ? `🚨 Traffic Jam! Road ${u} ↔ ${v}: ${w} km (Delays)`
                  : `Road ${u} ↔ ${v}: ${w} km`}
              </Tooltip>
            </Polyline>
          );
        })}

        {/* ── Minimum Spanning Tree (MST - Kruskal with DSU) ────── */}
        {mstEdges && mstEdges.map(([u, v, w], i) => (
          positions[u] && positions[v] ? (
            <Polyline
              key={`mst-poly-${i}-${u}-${v}`}
              positions={[positions[u], positions[v]]}
              pathOptions={{
                color: '#10b981',
                weight: 6,
                opacity: 0.95,
              }}
            >
              <Tooltip sticky>
                🌲 MST Backbone: Road {u} ↔ {v} ({w} km)
              </Tooltip>
            </Polyline>
          ) : null
        ))}

        {/* ── Single Path (Shortest / 1-Van Optimized Path) ───── */}
        {!multiRoutes && !mstEdges && pathLatLngs.length > 1 && (
          <Polyline
            positions={pathLatLngs}
            pathOptions={{
              color: '#22c55e',
              weight: 6,
              opacity: 0.95,
            }}
          />
        )}

        {/* ── Multi-Vehicle Fleet Routes (CVRP) ───── */}
        {multiRoutes && multiRoutes.map((vRoute, idx) => {
          const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
          const vLatLngs = (vRoute.stops || []).map(n => positions[n]).filter(Boolean);
          if (vLatLngs.length < 2) return null;
          return (
            <Polyline
              key={`vrp-poly-${vRoute.vehicleId || idx}`}
              positions={vLatLngs}
              pathOptions={{
                color: color,
                weight: 5,
                opacity: 0.9,
              }}
            >
              <Tooltip sticky>
                🚚 Van #{vRoute.vehicleId}: {vRoute.stops.length} stops ({vRoute.totalCost} km)
              </Tooltip>
            </Polyline>
          );
        })}

        {/* ── Nodes (CircleMarkers) ──────────────────────────── */}
        {positions.map((pos, i) => {
          const isSource = i === source;
          const isDest = i === destination;
          const isOnPath = path && path.includes(i);
          const isStop = highlightStops && highlightStops.includes(i);

          let assignedVehicle = null;
          if (multiRoutes) {
            multiRoutes.forEach((vr, vIdx) => {
              if (vr.stops && vr.stops.includes(i)) {
                assignedVehicle = {
                  id: vr.vehicleId,
                  color: VEHICLE_COLORS[vIdx % VEHICLE_COLORS.length],
                };
              }
            });
          }

          let color = '#38bdf8';            // cyan/blue
          let fillColor = '#0f172a';
          if (isStop) { color = '#f97316'; fillColor = '#ea580c'; }  // orange
          if (assignedVehicle) {
            color = assignedVehicle.color;
            fillColor = assignedVehicle.color;
          }
          if (isSource) { color = '#22c55e'; fillColor = '#16a34a'; } // green
          if (isDest && !multiRoutes) { color = '#ef4444'; fillColor = '#dc2626'; }   // red
          if (isOnPath && !isSource && !isDest) { color = '#38bdf8'; fillColor = '#0284c7'; }

          return (
            <CircleMarker
              key={`node-${i}`}
              center={pos}
              radius={18}
              pathOptions={{
                color: color,
                fillColor: fillColor,
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontWeight: 700, fontSize: '11px', color: '#ffffff' }}>
                  {assignedVehicle ? `🚚 Van #${assignedVehicle.id}: ` : ''}{getNodeName(i)}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── Real-Time Animated Delivery Van Markers (WebSockets) ── */}
        {liveVehicles && liveVehicles.map((v, idx) => {
          if (!v.currentCoords || v.currentCoords.length < 2) return null;
          const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
          return (
            <Marker
              key={`live-van-${v.vehicleId || idx}`}
              position={v.currentCoords}
              icon={createVanIcon(color)}
            >
              <Tooltip permanent direction="bottom" offset={[0, 14]}>
                <span style={{ fontWeight: 800, fontSize: '11px', color: color }}>
                  🚚 Van #{v.vehicleId} ({v.currentSpeedKmH || 30} km/h)
                </span>
              </Tooltip>
            </Marker>
          );
        })}

      </MapContainer>
    </div>
  );
}

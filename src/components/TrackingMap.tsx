import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface MapPosition {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

interface MemberTrack {
  userId: string;
  name: string;
  color: string;
  positions: MapPosition[];
  isMe: boolean;
}

interface Props {
  tracks: MemberTrack[];
  followUserId?: string | null;
  className?: string;
}

/** Auto-pan/zoom to follow a specific user's latest position. */
function FollowController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 16, { duration: 1.5 });
    }
  }, [target?.[0], target?.[1]]);
  return null;
}

/** Fit the map bounds to show all member positions. */
function FitBoundsController({ tracks }: { tracks: MemberTrack[] }) {
  const map = useMap();
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    const allPoints = tracks.flatMap((t) => t.positions);
    if (allPoints.length === 0) return;
    const bounds = L.latLngBounds(allPoints.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
    doneRef.current = true;
  }, [tracks, map]);
  return null;
}

function makeIcon(color: string, label: string, isMe: boolean): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        <div style="
          position: absolute; inset: 0; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: white;
          font-family: system-ui, sans-serif;
        ">${label}</div>
        ${isMe ? '<div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid ' + color + '; opacity: 0.4; animation: pulse 2s ease-in-out infinite;"></div>' : ''}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function TrackingMap({ tracks, followUserId, className }: Props) {
  const followedTarget: [number, number] | null = (() => {
    const t = tracks.find((tr) => tr.userId === followUserId);
    const last = t?.positions[t.positions.length - 1];
    return last ? [last.lat, last.lng] : null;
  })();

  // Default center: first available position, or a fallback
  const firstPos = tracks.flatMap((t) => t.positions)[0];
  const center: [number, number] = firstPos
    ? [firstPos.lat, firstPos.lng]
    : [24.7136, 46.6753]; // Riyadh as fallback

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ width: '100%', height: '100%', background: '#1a1a2e' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          // CartoDB dark tiles for a sleek look matching the app theme
        />

        <FitBoundsController tracks={tracks} />
        {followedTarget && <FollowController target={followedTarget} />}

        {tracks.map((track) => {
          if (track.positions.length === 0) return null;
          const last = track.positions[track.positions.length - 1];
          const pathLatLngs = track.positions.map((p) => [p.lat, p.lng] as [number, number]);

          return (
            <div key={track.userId}>
              {/* Accuracy circle */}
              {last.accuracy != null && last.accuracy > 0 && (
                <Circle
                  center={[last.lat, last.lng]}
                  radius={last.accuracy}
                  pathOptions={{
                    color: track.color,
                    fillColor: track.color,
                    fillOpacity: 0.1,
                    weight: 1,
                  }}
                />
              )}
              {/* Breadcrumb trail polyline */}
              {pathLatLngs.length > 1 && (
                <Polyline
                  positions={pathLatLngs}
                  pathOptions={{
                    color: track.color,
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '8 6',
                  }}
                />
              )}
              {/* Current position marker */}
              <Marker
                position={[last.lat, last.lng]}
                icon={makeIcon(track.color, track.name.charAt(0), track.isMe)}
              />
            </div>
          );
        })}
      </MapContainer>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 0; }
        }
        .leaflet-container {
          font-family: inherit;
        }
        .leaflet-control-zoom a {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #334155 !important;
        }
      `}</style>
    </div>
  );
}

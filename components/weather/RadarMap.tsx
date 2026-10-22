"use client";

// Real Doppler radar over OpenStreetMap base tiles, centered on the farm.
// Base tiles: OSM (https://tile.openstreetmap.org/{z}/{x}/{y}.png) — public cartography.
// Radar overlay: RainViewer (https://api.rainviewer.com/public/weather-maps.json) — the
// latest live frame, painted over the same tile grid. No marker is invented: the crosshair
// sits exactly on the farm's lat/lon, and the frame time is shown so staleness is visible.

import { useEffect, useMemo, useState } from "react";

const TILE = 256;
const ZOOM = 9;

interface RadarFrame {
  time: number;
  path: string;
}

interface RadarMeta {
  host: string;
  frame: RadarFrame | null;
}

async function fetchRadarMeta(): Promise<RadarMeta> {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Radar feed ${res.status}`);
  const json = (await res.json()) as {
    host?: string;
    radar?: { past?: { time: number; path: string }[] };
  };
  const host = json.host;
  const past = json.radar?.past ?? [];
  const latest = past.length > 0 ? past[past.length - 1] : null;
  if (!host || !latest) throw new Error("No radar frame");
  return { host, frame: { time: latest.time, path: latest.path } };
}

function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
  );
}

export function RadarMap({
  lat,
  lon,
  width,
  height,
}: {
  lat: number;
  lon: number;
  /** Container width in px (for centering the tile grid). */
  width: number;
  /** Container height in px. */
  height: number;
}) {
  const [meta, setMeta] = useState<RadarMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRadarMeta()
      .then((value) => {
        if (!cancelled) setMeta(value);
      })
      .catch(() => {
        if (!cancelled) setError("Radar feed is unavailable right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Center the fixed tile window on the farm's exact pixel position.
  const tiles = useMemo(() => {
    const worldX = lonToTileX(lon, ZOOM) * TILE;
    const worldY = latToTileY(lat, ZOOM) * TILE;
    const left = worldX - width / 2;
    const top = worldY - height / 2;
    const firstX = Math.floor(left / TILE);
    const lastX = Math.floor((left + width) / TILE);
    const firstY = Math.floor(top / TILE);
    const lastY = Math.floor((top + height) / TILE);
    const out: { x: number; y: number; left: number; top: number }[] = [];
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        out.push({ x, y, left: x * TILE - left, top: y * TILE - top });
      }
    }
    return { out, left, top, worldX, worldY };
  }, [lat, lon, width, height]);

  const frameTime = meta?.frame
    ? new Date(meta.frame.time * 1000).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  // Capture so TypeScript can narrow inside the .map() callbacks below.
  const radarHost = meta?.host ?? null;
  const radarPath = meta?.frame?.path ?? null;

  return (
    <div
      className="relative overflow-hidden rounded border border-outline-variant bg-surface-container-low"
      style={{ width, height }}
    >
      {/* OpenStreetMap base layer */}
      {tiles.out.map((tile) => (
        <img
          key={`base-${tile.x}-${tile.y}`}
          src={`https://tile.openstreetmap.org/${ZOOM}/${tile.x}/${tile.y}.png`}
          alt=""
          aria-hidden="true"
          width={TILE}
          height={TILE}
          className="absolute select-none"
          style={{ left: tile.left, top: tile.top }}
          loading="lazy"
          draggable={false}
        />
      ))}

      {/* RainViewer Doppler radar overlay (semi-transparent over the base map) */}
      {radarHost && radarPath
        ? tiles.out.map((tile) => (
            <img
              key={`radar-${tile.x}-${tile.y}`}
              src={`${radarHost}${radarPath}/256/${ZOOM}/${tile.x}/${tile.y}/4/1_1.png`}
              alt=""
              aria-hidden="true"
              width={TILE}
              height={TILE}
              className="absolute select-none"
              style={{ left: tile.left, top: tile.top, opacity: 0.65 }}
              loading="lazy"
              draggable={false}
            />
          ))
        : null}

      {/* Center crosshair pinned to the farm's exact coordinates */}
      <div
        className="pointer-events-none absolute"
        style={{ left: tiles.worldX - tiles.left, top: tiles.worldY - tiles.top }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div className="h-6 w-6 rounded-full border-2 border-accent/70" />
          <div className="mx-auto -mt-[15px] h-2 w-2 rounded-full bg-accent ring-4 ring-accent/20" />
        </div>
      </div>

      {/* Status chips — always visible so the source and freshness are honest */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2">
        <span className="rounded-input bg-surface/90 px-2.5 py-1 font-mono text-xs text-text shadow-sm">
          {ZOOM}× · {lat.toFixed(4)}°, {lon.toFixed(4)}°
        </span>
        {error ? (
          <span className="rounded-input border border-warning/30 bg-warning-bg px-2.5 py-1 text-xs text-warning shadow-sm">
            Base map only — {error}
          </span>
        ) : meta?.frame ? (
          <span className="rounded-input bg-surface/90 px-2.5 py-1 font-mono text-xs text-text shadow-sm">
            Doppler frame {frameTime}
          </span>
        ) : (
          <span className="rounded-input bg-surface/90 px-2.5 py-1 text-xs text-muted shadow-sm">
            Loading radar…
          </span>
        )}
      </div>

      {/* Attribution — required by OSM / RainViewer tile policies */}
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-surface/80 px-1.5 py-0.5 text-[10px] leading-4 text-muted">
        © OpenStreetMap · RainViewer
      </div>
    </div>
  );
}

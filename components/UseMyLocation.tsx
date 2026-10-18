"use client";

// "Use my location" (optional, S-FARM): fills the latitude/longitude inputs from the
// browser. Nothing is sent anywhere except the settings form the farmer submits.

import { useState } from "react";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function UseMyLocation() {
  const [message, setMessage] = useState<string | null>(null);

  function fill() {
    if (!("geolocation" in navigator)) {
      setMessage("This browser cannot share a location. Type the coordinates instead.");
      return;
    }
    setMessage("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = document.getElementById("lat") as HTMLInputElement | null;
        const lon = document.getElementById("lon") as HTMLInputElement | null;
        if (lat) lat.value = pos.coords.latitude.toFixed(4);
        if (lon) lon.value = pos.coords.longitude.toFixed(4);
        setMessage("Location filled in. Check it, then save.");
      },
      () => {
        setMessage("Could not get your location. Type the coordinates instead.");
      },
      { timeout: 10_000 }
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={fill}
        className={`inline-flex h-12 items-center rounded-input border border-border bg-surface px-4 text-base font-medium text-text hover:bg-bg ${focusRing}`}
      >
        Use my location
      </button>
      {message ? (
        <p role="status" className="mt-2 text-sm leading-5 text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

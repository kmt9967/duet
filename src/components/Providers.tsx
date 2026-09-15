"use client";

/**
 * Client providers.
 *
 * The PCM recorder needs a real AudioContext, which can only be constructed in
 * the browser and only after a user gesture on some platforms. We create it
 * lazily on first use and hand it to the provider, so server rendering stays
 * clean and no audio permission is requested until the operator asks for it.
 */

import { PCMAudioRecorderProvider } from "@speechmatics/browser-audio-input-react";
import { useEffect, useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Lazily constructed once, and only in the browser — there is no AudioContext
  // during server rendering. Speechmatics accepts a wide range of sample rates,
  // so using the device's native rate avoids a resampling pass.
  const [audioContext] = useState<AudioContext | undefined>(() =>
    typeof window === "undefined" ? undefined : new AudioContext(),
  );

  useEffect(() => {
    return () => {
      void audioContext?.close().catch(() => {});
    };
  }, [audioContext]);

  return (
    <PCMAudioRecorderProvider
      audioContext={audioContext}
      workletScriptURL="/pcm-audio-worklet.min.js"
    >
      {children}
    </PCMAudioRecorderProvider>
  );
}

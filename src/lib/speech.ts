/**
 * SPEECH-TO-TEXT — one entry point that works in the native app (via the
 * @capacitor-community/speech-recognition plugin) and falls back to the browser Web Speech API
 * where it exists. Android System WebView does NOT implement Web Speech, which is why the mic never
 * worked in the app — the native plugin is what makes it real (requires a fresh native build).
 *
 * All Capacitor imports are dynamic so nothing loads during SSR/build.
 */

export interface SttHandle {
  stop: () => void;
}

async function nativeAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("SpeechRecognition")) return false;
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const res = await SpeechRecognition.available();
    return !!res.available;
  } catch {
    return false;
  }
}

function webCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface WebSpeechRecognition {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

/** True if STT can run at all (native plugin present, or the browser exposes Web Speech). */
export async function sttSupported(): Promise<boolean> {
  if (await nativeAvailable()) return true;
  return webCtor() !== null;
}

/**
 * Start listening. `onText` receives the running transcript; `onEnd` fires when it stops/errors.
 * Returns a handle to stop, or null if it couldn't start (permission denied / unsupported).
 */
export async function startStt(onText: (t: string) => void, onEnd: () => void): Promise<SttHandle | null> {
  // Native
  if (await nativeAvailable()) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") {
        onEnd();
        return null;
      }
      await SpeechRecognition.removeAllListeners();
      await SpeechRecognition.addListener("partialResults", (data: { matches?: string[] }) => {
        const t = data.matches?.[0];
        if (t) onText(t);
      });
      await SpeechRecognition.addListener("listeningState", (data: { status?: string }) => {
        if (data.status === "stopped") onEnd();
      });
      await SpeechRecognition.start({ language: "en-US", partialResults: true, popup: false });
      return {
        stop: () => {
          void SpeechRecognition.stop().catch(() => {});
          void SpeechRecognition.removeAllListeners().catch(() => {});
          onEnd();
        },
      };
    } catch {
      onEnd();
      return null;
    }
  }

  // Web fallback
  const Ctor = webCtor();
  if (!Ctor) {
    onEnd();
    return null;
  }
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.onresult = (e) => {
    let t = "";
    for (let i = 0; i < e.results.length; i++) t += e.results[i]?.[0]?.transcript ?? "";
    onText(t);
  };
  rec.onend = onEnd;
  rec.onerror = onEnd;
  rec.start();
  return { stop: () => rec.stop() };
}

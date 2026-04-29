"use client";
import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "desktop";

// Captures the platform-fired install event so we can re-fire it from a
// button click later. Chrome/Edge fire `beforeinstallprompt` with this shape.
type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari sets navigator.standalone; modern browsers expose
  // display-mode: standalone via media query.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<DeferredPrompt | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as DeferredPrompt);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function triggerInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  if (installed) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="text-xs font-mono tracking-widest text-signal">INSTALLED</div>
        <h1 className="h-display text-3xl tracking-wider">YOU'RE ALL SET.</h1>
        <p className="text-ink-muted">
          Backstop is running as an installed app. You can launch it any time from your home screen.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <div className="text-xs font-mono tracking-widest text-signal mb-2">INSTALL BACKSTOP</div>
        <h1 className="h-display text-3xl tracking-wider">Add Backstop to your home screen.</h1>
        <p className="text-ink-muted mt-2">
          Get the dashboard one tap away — no App Store, no download. Backstop opens full-screen and
          remembers you signed in.
        </p>
      </div>

      {/* If the browser advertised an install prompt we can fire it directly. */}
      {prompt && (
        <button
          onClick={triggerInstall}
          className="bg-signal text-bg px-6 py-3 font-semibold hover:bg-signal-dim"
        >
          Install Backstop
        </button>
      )}

      {/* Tabbed instructions per detected platform with the others available. */}
      <div className="flex gap-1 border border-line w-fit">
        {(["ios", "android", "desktop"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-3 py-2 text-xs font-mono tracking-widest transition ${
              platform === p ? "bg-signal text-bg" : "text-ink-muted hover:text-ink"
            }`}
          >
            {p === "ios" ? "IPHONE / IPAD" : p === "android" ? "ANDROID" : "DESKTOP"}
          </button>
        ))}
      </div>

      {platform === "ios" && (
        <Steps
          subtitle="Use Safari (Chrome on iOS does not support adding to home screen)."
          steps={[
            "Tap the Share button in the bottom toolbar (the square with an upward arrow).",
            'Scroll and tap "Add to Home Screen".',
            'Confirm the name (Backstop) and tap "Add".',
            "Open Backstop from your home screen — it runs full-screen, no browser bars.",
          ]}
        />
      )}

      {platform === "android" && (
        <Steps
          subtitle="Use Chrome, Edge, or Samsung Internet."
          steps={[
            "Tap the three-dot menu in the top right of your browser.",
            'Tap "Install app" or "Add to Home screen".',
            "Confirm. Backstop will appear in your app drawer like a native app.",
          ]}
        />
      )}

      {platform === "desktop" && (
        <Steps
          subtitle="Chrome, Edge, Brave, and Arc all support PWA install."
          steps={[
            "Look for the install icon in the right side of the address bar (a small monitor with a downward arrow).",
            'Click it, then click "Install".',
            "Backstop opens in its own window and gets pinned to your taskbar / Dock.",
          ]}
        />
      )}

      <div className="bg-bg-panel border border-line p-4 text-sm text-ink-muted">
        Players don't need to install anything — they just open your booking link in a browser.
      </div>
    </div>
  );
}

function Steps({ subtitle, steps }: { subtitle: string; steps: string[] }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-ink-dim">{subtitle}</div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 bg-bg-panel border border-line p-3">
            <span className="text-signal font-mono text-sm shrink-0 w-6">{i + 1}.</span>
            <span className="text-sm">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

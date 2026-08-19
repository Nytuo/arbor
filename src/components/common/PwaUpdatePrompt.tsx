import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { isTauri } from "@tauri-apps/api/core";

export default function PwaUpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisterError: (error) => console.error("Service worker registration failed", error),
  });

  useEffect(() => {
    if (isTauri() || !needRefresh[0]) return;

    toast("A new version of Arbor is available.", {
      id: "pwa-update-available",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => updateServiceWorker(true),
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}

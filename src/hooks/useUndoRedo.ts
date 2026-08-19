import { useEffect } from "react";
import { useStore } from "zustand";
import { useTreeStore } from "@/store/useTreeStore";

const isTypingTarget = (el: EventTarget | null) => {
  const active = el as HTMLElement | null;
  return !!active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
};

export const useUndoRedo = () => {
  const temporalState = useStore(useTreeStore.temporal, (s) => s);
  const canUndo = temporalState.pastStates.length > 0;
  const canRedo = temporalState.futureStates.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isTypingTarget(document.activeElement)) return;
      if (e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) temporalState.redo();
      else temporalState.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [temporalState]);

  return { undo: temporalState.undo, redo: temporalState.redo, canUndo, canRedo };
};

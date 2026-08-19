import React, { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTreeStore } from "@/store/useTreeStore";
import { useTreeEditor, GEN_ROW_HEIGHT } from "./rete/useTreeEditor";
import { isPersonNode, isGroupNode } from "./rete/schema";
import { addPersonAtViewportCenter } from "./rete/actions";

interface TreeCanvasProps {
  genGrid: boolean;
}

const TreeCanvas: React.FC<TreeCanvasProps> = ({ genGrid }) => {
  const { t } = useTranslation();
  const { deletePerson, deleteGroup } = useTreeStore();

  const { containerRef, editorRef, ready, transform, setGenGridActive } = useTreeEditor(t);

  useEffect(() => {
    setGenGridActive(genGrid);
  }, [genGrid, setGenGridActive]);

  const handleAddPerson = useCallback(() => addPersonAtViewportCenter(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (typing) return;

      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        handleAddPerson();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && editorRef.current) {
        const selected = editorRef.current.getNodes().filter((n) => n.selected);
        if (selected.length === 0) return;
        if (!window.confirm(t("deleteConfirm"))) return;
        for (const node of selected) {
          if (isPersonNode(node)) deletePerson(node.personId);
          else if (isGroupNode(node)) deleteGroup(node.groupId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleAddPerson, editorRef, deletePerson, deleteGroup, t]);

  return (
    <div className="w-full h-full bg-slate-50 relative">
      <div ref={containerRef} className="w-full h-full" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {t("preparing")}
        </div>
      )}

      {genGrid && <GenerationGridOverlay transform={transform} />}
    </div>
  );
};

const GenerationGridOverlay: React.FC<{ transform: { x: number; y: number; k: number } }> = ({ transform }) => {
  const { t } = useTranslation();
  const { y, k } = transform;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 1000;
  const minWorldY = -y / k - GEN_ROW_HEIGHT;
  const maxWorldY = (viewportH - y) / k + GEN_ROW_HEIGHT;
  const firstRow = Math.floor(minWorldY / GEN_ROW_HEIGHT);
  const lastRow = Math.ceil(maxWorldY / GEN_ROW_HEIGHT);
  const rowHeightPx = GEN_ROW_HEIGHT * k;

  const bands: React.ReactElement[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const wy = row * GEN_ROW_HEIGHT;
    const screenY = Math.round(wy * k + y);
    const genNumber = row + 1;
    bands.push(
      <div
        key={`band-${row}`}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: screenY,
          height: rowHeightPx,
          width: "100%",
          background: row % 2 === 0 ? "rgba(15,23,42,0.025)" : "transparent",
          borderTop: "1px solid rgba(15,23,42,0.08)",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />,
    );
    if (rowHeightPx > 24) {
      bands.push(
        <div
          key={`label-${row}`}
          aria-hidden
          className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50/90 rounded px-1.5 py-0.5"
          style={{ position: "absolute", left: 8, top: screenY + 6, pointerEvents: "none", zIndex: 21 }}
        >
          {t("generationLabel", { n: genNumber })}
        </div>,
      );
    }
  }
  return <>{bands}</>;
};

export default TreeCanvas;

import { memo, useState, useRef } from "react";
import { X, Palette } from "lucide-react";
import { useTreeStore } from "@/store/useTreeStore";
import type { GroupRete } from "@/components/canvas/rete/schema";
import { useAreaCtx } from "@/components/canvas/rete/area-context";
import { cn } from "@/lib/utils";

const COLORS: { key: string; border: string; bg: string; text: string }[] = [
  { key: "slate", border: "#94a3b8", bg: "rgba(100,116,139,0.08)", text: "#334155" },
  { key: "emerald", border: "#34d399", bg: "rgba(16,185,129,0.08)", text: "#047857" },
  { key: "amber", border: "#fbbf24", bg: "rgba(245,158,11,0.08)", text: "#b45309" },
  { key: "rose", border: "#fb7185", bg: "rgba(244,63,94,0.08)", text: "#be123c" },
  { key: "sky", border: "#38bdf8", bg: "rgba(14,165,233,0.08)", text: "#0369a1" },
  { key: "violet", border: "#a78bfa", bg: "rgba(139,92,246,0.08)", text: "#6d28d9" },
];
const colorFor = (key?: string) => COLORS.find((c) => c.key === key) || COLORS[0];
const MIN_W = 160;
const MIN_H = 120;

type Props = { data: GroupRete & { selected?: boolean } };

const GroupNodeComponent = ({ data }: Props) => {
  const { area } = useAreaCtx();
  const group = useTreeStore((s) => s.groups.find((g) => g.id === data.groupId));
  const updateGroup = useTreeStore((s) => s.updateGroup);
  const deleteGroup = useTreeStore((s) => s.deleteGroup);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(group?.label || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);
  const liveSizeRef = useRef({ width: data.width, height: data.height });

  if (!group) return null;
  const c = colorFor(group.color);

  const commitLabel = () => {
    setEditing(false);
    updateGroup(group.id, { label });
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, w: data.width, h: data.height };
  };
  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const w = Math.max(MIN_W, Math.round(dragRef.current.w + dx));
    const h = Math.max(MIN_H, Math.round(dragRef.current.h + dy));
    liveSizeRef.current = { width: w, height: h };
    void area.resize(data.id, w, h);
  };
  const onResizePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    updateGroup(group.id, { size: liveSizeRef.current });
  };

  return (
    <div
      className="relative w-full h-full rounded-2xl border-2 border-dashed"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="absolute -top-3 left-3">
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") {
                setLabel(group.label || "");
                setEditing(false);
              }
            }}
            className="px-2 py-0.5 text-xs font-bold rounded-md border outline-none shadow-sm"
            style={{ color: c.text, borderColor: c.border, background: "white" }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            onPointerDown={(e) => e.stopPropagation()}
            title="Double-click to rename"
            className="px-2 py-0.5 text-xs font-bold rounded-md shadow-sm bg-white border max-w-[220px] truncate block"
            style={{ color: c.text, borderColor: c.border }}
          >
            {group.label || "Untitled group"}
          </button>
        )}
      </div>

      {data.selected && (
        <div className="absolute -top-3 right-3 flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPickerOpen((v) => !v)}
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
              style={{ background: c.border }}
              aria-label="Change color"
            >
              <Palette size={11} className="text-white" />
            </button>
            {pickerOpen && (
              <div className="absolute top-7 right-0 flex gap-1 p-1.5 bg-white rounded-lg shadow-lg border border-border z-50">
                {COLORS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      updateGroup(group.id, { color: opt.key });
                      setPickerOpen(false);
                    }}
                    className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                    style={{ background: opt.border }}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => deleteGroup(group.id)}
            className="w-6 h-6 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 border border-border"
            aria-label="Delete group"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div
        role="presentation"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        className={cn(
          "absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize rounded-tl",
          data.selected ? "opacity-100" : "opacity-0",
        )}
        style={{ background: c.border }}
      />
    </div>
  );
};

export default memo(GroupNodeComponent);

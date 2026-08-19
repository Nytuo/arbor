import { useState } from "react";
import { Presets } from "rete-react-plugin";
import { useTranslation } from "react-i18next";
import { useTreeStore } from "@/store/useTreeStore";
import type { RelConnection } from "@/components/canvas/rete/schema";
import type { Relationship } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const { useConnection } = Presets.classic;

const SPOUSE_COLOR = "#f472b6";
const PARENT_COLOR = "#64748b";
const STEP_COLOR = "#f59e0b";

interface Point {
  x: number;
  y: number;
}

const buildPath = (start: Point, end: Point, kind: "spouse" | "parent"): string => {
  if (kind === "spouse") {
    if (Math.abs(start.y - end.y) < 2) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const midX = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }
  const midY = (start.y + end.y) / 2;
  return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
};

const RelationshipEditor = ({ relationship }: { relationship: Relationship }) => {
  const { t } = useTranslation();
  const updateRelationship = useTreeStore((s) => s.updateRelationship);

  if (relationship.type === "SPOUSE") {
    return (
      <div className="space-y-3 w-56">
        <div className="space-y-1.5">
          <Label>{t("status")}</Label>
          <Select
            value={relationship.metadata?.status ?? "married"}
            onValueChange={(v) =>
              updateRelationship(relationship.id, { metadata: { ...relationship.metadata, status: v as "married" | "divorced" | "partnered" } })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="married">{t("married")}</SelectItem>
              <SelectItem value="partnered">{t("partnered")}</SelectItem>
              <SelectItem value="divorced">{t("divorced")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("date")}</Label>
          <Input
            type="date"
            value={relationship.metadata?.date ?? ""}
            onChange={(e) => updateRelationship(relationship.id, { metadata: { ...relationship.metadata, date: e.target.value } })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-56">
      <Label>{t("relationshipType")}</Label>
      <Select
        value={relationship.metadata?.relationshipType ?? "biological"}
        onValueChange={(v) =>
          updateRelationship(relationship.id, {
            metadata: { ...relationship.metadata, relationshipType: v as "biological" | "adopted" | "step" },
          })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="biological">{t("biological")}</SelectItem>
          <SelectItem value="adopted">{t("adopted")}</SelectItem>
          <SelectItem value="step">{t("stepRelationship")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

const ConnectionComponent = ({ data }: { data: RelConnection }) => {
  const { start, end } = useConnection();
  const relationship = useTreeStore((s) => s.relationships.find((r) => r.id === data.relationshipId));
  const [open, setOpen] = useState(false);
  if (!start || !end) return null;

  const isSpecial = relationship?.metadata?.relationshipType === "adopted" || relationship?.metadata?.relationshipType === "step";
  const color = data.kind === "spouse" ? SPOUSE_COLOR : isSpecial ? STEP_COLOR : PARENT_COLOR;
  const d = buildPath(start, end, data.kind);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <svg
      data-testid="connection"
      style={{ overflow: "visible", position: "absolute", top: 0, left: 0, width: 9999, height: 9999, pointerEvents: "none" }}
    >
      {data.kind === "parent" && (
        <marker id={`arrow-${data.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={data.kind === "spouse" ? 2.5 : 2}
        strokeDasharray={isSpecial ? "6 4" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={data.kind === "parent" ? `url(#arrow-${data.id})` : undefined}
      />
      {relationship && (
        <foreignObject x={midX - 8} y={midY - 8} width={16} height={16} style={{ pointerEvents: "auto" }}>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Edit relationship"
                className="w-4 h-4 rounded-full cursor-pointer opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                style={{ background: color }}
              />
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto">
              <RelationshipEditor relationship={relationship} />
            </PopoverContent>
          </Popover>
        </foreignObject>
      )}
    </svg>
  );
};

export default ConnectionComponent;

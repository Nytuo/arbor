import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Presets } from "rete-react-plugin";
import type { RenderEmit } from "rete-react-plugin";
import { User, UserRound, Users } from "lucide-react";
import { useTreeStore } from "@/store/useTreeStore";
import { fullName } from "@/utils/treeExport";
import type { Person } from "@/types";
import type { PersonRete, Schemes } from "@/components/canvas/rete/schema";
import { cn } from "@/lib/utils";

const { RefSocket } = Presets.classic;

type Props = {
  data: PersonRete & { selected?: boolean };
  emit: RenderEmit<Schemes>;
};

const getYear = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? dateStr.slice(0, 4) : String(date.getFullYear());
};

const genderStyles = (gender?: Person["gender"]) => {
  switch (gender) {
    case "M":
      return "border-blue-200 bg-blue-50/50 text-blue-700";
    case "F":
      return "border-pink-200 bg-pink-50/50 text-pink-700";
    case "O":
      return "border-purple-200 bg-purple-50/50 text-purple-700";
    default:
      return "border-slate-200 bg-slate-50/50 text-slate-700";
  }
};

const PersonNodeComponent = ({ data, emit }: Props) => {
  const { t } = useTranslation();
  const person = useTreeStore((s) => s.people.find((p) => p.id === data.personId));
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);

  if (!person) return null;

  const birthYear = getYear(person.birthDate);
  const deathYear = getYear(person.deathDate);
  const lifeSpan = birthYear || deathYear ? `${birthYear || "?"} - ${deathYear || t("present")}` : "";
  const styles = genderStyles(person.gender);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={fullName(person, t)}
      onPointerDown={() => setSelectedPersonId(person.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setSelectedPersonId(person.id);
      }}
      className={cn(
        "relative px-4 py-4 shadow-lg rounded-2xl border-2 bg-card cursor-pointer transition-all duration-150",
        data.selected
          ? "border-primary ring-4 ring-primary/10 z-50"
          : "border-transparent hover:border-border",
      )}
      style={{ width: data.width, minHeight: data.height }}
    >
      <div className="absolute -top-1.5 left-[calc(50%-6px)] w-3 h-3 rounded-full bg-slate-300 border-2 border-white">
        <RefSocket
          name="input-socket"
          side="input"
          socketKey="parent"
          nodeId={data.id}
          emit={emit}
          payload={data.inputs.parent!.socket}
        />
      </div>

      <div className="flex items-start gap-3">
        {person.photo ? (
          <img
            src={person.photo}
            alt=""
            className="rounded-xl w-14 h-14 object-cover shrink-0 border-2 border-border shadow-sm"
          />
        ) : (
          <div className={cn("rounded-xl w-14 h-14 flex items-center justify-center shrink-0 border-2 shadow-sm", styles)}>
            {person.gender === "M" ? <User size={26} /> : person.gender === "F" ? <UserRound size={26} /> : <Users size={26} />}
          </div>
        )}
        <div className="text-left overflow-hidden min-w-0 flex-1">
          <div className="text-sm font-bold text-foreground leading-tight break-words">{fullName(person, t)}</div>
          {person.maidenName && (
            <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{`${t("maidenPrefix")} ${person.maidenName}`}</div>
          )}
          <div className="text-[10px] font-bold text-muted-foreground/70 mt-0.5 tracking-tight uppercase">{lifeSpan}</div>
          {person.notes && <div className="mt-1 text-[11px] text-muted-foreground break-words">{person.notes}</div>}
        </div>
      </div>

      <div className="absolute -bottom-1.5 left-[calc(50%-6px)] w-3 h-3 rounded-full bg-slate-300 border-2 border-white">
        <RefSocket
          name="output-socket"
          side="output"
          socketKey="child"
          nodeId={data.id}
          emit={emit}
          payload={data.outputs.child!.socket}
        />
      </div>
      <div className="absolute top-[calc(50%-6px)] -right-1.5 w-3 h-3 rounded-full bg-pink-400 border-2 border-white">
        <RefSocket
          name="output-socket"
          side="output"
          socketKey="spouseOut"
          nodeId={data.id}
          emit={emit}
          payload={data.outputs.spouseOut!.socket}
        />
      </div>
      <div className="absolute top-[calc(50%-6px)] -left-1.5 w-3 h-3 rounded-full bg-pink-400 border-2 border-white">
        <RefSocket
          name="input-socket"
          side="input"
          socketKey="spouseIn"
          nodeId={data.id}
          emit={emit}
          payload={data.inputs.spouseIn!.socket}
        />
      </div>
    </div>
  );
};

export default memo(PersonNodeComponent);

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTreeStore } from "@/store/useTreeStore";
import { jumpToPerson } from "@/components/canvas/rete/actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { User, UserRound, Users } from "lucide-react";
import { formatPersonName } from "@/utils/treeExport";

const displayName = (p: { firstName?: string; lastName?: string }, unknownLabel: string) =>
  formatPersonName(p) || unknownLabel;

const genderIcon = (gender?: string) => {
  if (gender === "M") return User;
  if (gender === "F") return UserRound;
  return Users;
};

const CommandPalette: React.FC = () => {
  const { t } = useTranslation();
  const people = useTreeStore((s) => s.people);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSelect = (personId: string) => {
    jumpToPerson(personId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="p-0 gap-0 max-w-lg overflow-hidden">
        <DialogTitle className="sr-only">{t("jumpToPerson")}</DialogTitle>
        <Command shouldFilter>
          <CommandInput placeholder={t("jumpToPerson")} autoFocus />
          <CommandList>
            <CommandEmpty>{t("noPeopleFound")}</CommandEmpty>
            <CommandGroup>
              {people.map((p) => {
                const Icon = genderIcon(p.gender);
                return (
                  <CommandItem key={p.id} value={`${p.firstName ?? ""} ${p.lastName ?? ""} ${p.id}`} onSelect={() => handleSelect(p.id)}>
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <Icon size={16} className="text-muted-foreground" />
                    )}
                    {displayName(p, t("unknown"))}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;

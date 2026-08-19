import React, { useRef, useState, useEffect } from "react";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { v4 as uuidv4 } from "uuid";
import { useTreeStore } from "@/store/useTreeStore";
import type { Person, PersonImage, RelationshipType } from "@/types";
import {
  X,
  Trash2,
  Plus,
  Heart,
  Link,
  UserPlus,
  ImagePlus,
  ImageOff,
  Crop,
  CalendarIcon,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ImageCropper from "./ImageCropper";
import { MAX_EXTRA_IMAGE_DIM, readFileAsDataUrl, resizeImageDataUrl } from "@/utils/imageUtils";
import type { CropRect } from "@/utils/imageUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/utils/treeExport";

const displayName = (p: Pick<Person, "firstName" | "lastName">, unknownLabel: string) =>
  formatPersonName(p) || unknownLabel;

const parseDate = (s?: string) => (s ? new Date(s) : undefined);

const Sidebar: React.FC = () => {
  const {
    people,
    relationships,
    selectedPersonId,
    setSelectedPersonId,
    updatePerson,
    deletePerson,
    addPerson,
    addRelationship,
    deleteRelationship,
  } = useTreeStore();
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith("fr");
  const dateDisplayFormat = isFr ? "dd/MM/yyyy" : "yyyy-MM-dd";

  const person = people.find((p) => p.id === selectedPersonId);
  const [formData, setFormData] = useState<Partial<Person>>({});
  const [isAddingRelative, setIsAddingRelative] = useState(false);
  const [relativeSearch, setRelativeSearch] = useState("");
  const [relType, setRelType] = useState<RelationshipType>("PARENT_CHILD");
  const [comboOpen, setComboOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [cropSourceImageId, setCropSourceImageId] = useState<string | null>(null);
  const [cropInitial, setCropInitial] = useState<CropRect | undefined>(undefined);

  useEffect(() => {
    if (person) {
      setFormData(person);
      setIsAddingRelative(false);
    }
  }, [person]);

  if (!selectedPersonId) {
    return (
      <div className="w-80 h-full border-l bg-card p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-foreground">{t("appName")}</h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{t("selectPersonDesc")}</p>
        <Button
          className="w-full"
          onClick={() => {
            const id = addPerson({ firstName: "", lastName: "" });
            setSelectedPersonId(id);
          }}
        >
          <UserPlus size={18} />
          {t("addPerson")}
        </Button>
      </div>
    );
  }

  if (!person) return null;

  const today = new Date();
  const birthDate = parseDate(formData.birthDate);
  const deathDate = parseDate(formData.deathDate);
  const birthAfterDeath = !!birthDate && !!deathDate && birthDate > deathDate;
  const birthInFuture = !!birthDate && birthDate > today;
  const deathInFuture = !!deathDate && deathDate > today;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    updatePerson(person.id, { [name]: value });
  };

  const handleGenderChange = (value: string) => {
    setFormData((prev) => ({ ...prev, gender: value as Person["gender"] }));
    updatePerson(person.id, { gender: value as Person["gender"] });
  };

  const handleDateChange = (field: "birthDate" | "deathDate", date: Date | undefined) => {
    const value = date ? format(date, "yyyy-MM-dd") : "";
    setFormData((prev) => ({ ...prev, [field]: value }));
    updatePerson(person.id, { [field]: value });
  };

  const handleAddRelationship = (targetId: string) => {
    if (targetId === person.id) return;
    const exists = relationships.some(
      (r) =>
        (r.fromId === person.id && r.toId === targetId && r.type === relType) ||
        (r.fromId === targetId && r.toId === person.id && r.type === relType),
    );
    if (!exists) addRelationship({ type: relType, fromId: person.id, toId: targetId });
    setIsAddingRelative(false);
    setComboOpen(false);
    setRelativeSearch("");
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    const raw = await readFileAsDataUrl(file);
    const resized = await resizeImageDataUrl(raw, MAX_EXTRA_IMAGE_DIM);
    const image: PersonImage = { id: uuidv4(), dataUrl: resized };
    updatePerson(person.id, { extraImages: [...(person.extraImages || []), image] });
    setCropSourceImageId(image.id);
    setCropInitial(undefined);
    setCropperSrc(resized);
  };

  const openCropperFor = (imageId: string, dataUrl: string, initial?: CropRect) => {
    setCropSourceImageId(imageId);
    setCropInitial(initial);
    setCropperSrc(dataUrl);
  };

  const handleAdjustPhoto = () => {
    const sourceId = person.photoCrop?.sourceImageId;
    const source = sourceId ? person.extraImages?.find((img) => img.id === sourceId) : undefined;
    if (!source) return; // Photo predates photoCrop tracking, or its source was deleted - nothing to restore from.
    openCropperFor(source.id, source.dataUrl, {
      x: person.photoCrop!.x,
      y: person.photoCrop!.y,
      width: person.photoCrop!.size,
      height: person.photoCrop!.size,
    });
  };

  const handleCropSave = (croppedDataUrl: string, crop: CropRect) => {
    updatePerson(person.id, {
      photo: croppedDataUrl,
      photoCrop: cropSourceImageId ? { sourceImageId: cropSourceImageId, x: crop.x, y: crop.y, size: crop.width } : undefined,
    });
    setCropperSrc(null);
    setCropSourceImageId(null);
    setCropInitial(undefined);
  };

  const handleDeleteExtraImage = (imageId: string) => {
    updatePerson(person.id, {
      extraImages: (person.extraImages || []).filter((img) => img.id !== imageId),
    });
  };

  const filteredPeople = people.filter(
    (p) => p.id !== person.id && `${p.firstName} ${p.lastName}`.toLowerCase().includes(relativeSearch.toLowerCase()),
  );

  const personRelationships = relationships.filter((r) => r.fromId === person.id || r.toId === person.id);

  return (
    <div className="w-80 h-full border-l bg-card shadow-xl overflow-y-auto z-10 flex flex-col border-border">
      <div className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-card/80 backdrop-blur-md z-20">
        <h2 className="font-bold text-foreground truncate pr-2">{displayName(person, t("unknown"))}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setSelectedPersonId(null)}
          aria-label={t("cancel")}
        >
          <X size={18} />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        <section>
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{t("photo")}</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              {person.photo ? (
                <img
                  src={person.photo}
                  alt=""
                  className="w-16 h-16 rounded-2xl object-cover border border-border shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center text-muted-foreground">
                  <ImagePlus size={22} />
                </div>
              )}
              {person.photo && (
                <button
                  type="button"
                  onClick={() => updatePerson(person.id, { photo: undefined })}
                  title={t("removePhoto")}
                  aria-label={t("removePhoto")}
                  className="absolute -top-1.5 -right-1.5 bg-card border border-border rounded-full p-1 text-muted-foreground hover:text-destructive shadow-sm"
                >
                  <ImageOff size={12} />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80"
              >
                <ImagePlus size={14} />
                {t("addPhoto")}
              </button>
              {person.photo && person.photoCrop && (
                <button
                  type="button"
                  onClick={handleAdjustPhoto}
                  className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary"
                >
                  <Crop size={14} />
                  {t("adjustPhoto")}
                </button>
              )}
              <input
                type="file"
                ref={photoInputRef}
                onChange={handlePhotoFile}
                accept="image/*"
                className="hidden"
                aria-label={t("addPhoto")}
              />
              <p className="text-[11px] text-muted-foreground leading-snug">{t("photoHint")}</p>
            </div>
          </div>

          {person.extraImages && person.extraImages.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                {t("extraImages")}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {person.extraImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.dataUrl}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg border border-border"
                    />
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => openCropperFor(img.id, img.dataUrl)}
                        title={t("useAsPhoto")}
                        aria-label={t("useAsPhoto")}
                        className="p-1 bg-white/90 rounded-md text-slate-700 hover:text-primary"
                      >
                        <Crop size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExtraImage(img.id)}
                        title={t("deleteImage")}
                        aria-label={t("deleteImage")}
                        className="p-1 bg-white/90 rounded-md text-slate-700 hover:text-destructive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="h-px bg-border" />

        <section className="space-y-4">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t("details")}</h3>

          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t("firstName")}</Label>
            <Input id="firstName" name="firstName" value={formData.firstName || ""} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t("lastName")}</Label>
            <Input id="lastName" name="lastName" value={formData.lastName || ""} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maidenName">{t("maidenName")}</Label>
            <Input id="maidenName" name="maidenName" value={formData.maidenName || ""} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("gender")}</Label>
            <Select value={formData.gender || "U"} onValueChange={handleGenderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="U">{t("unknown")}</SelectItem>
                <SelectItem value="M">{t("male")}</SelectItem>
                <SelectItem value="F">{t("female")}</SelectItem>
                <SelectItem value="O">{t("other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("birthDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    aria-invalid={birthAfterDeath || birthInFuture}
                    className={cn(
                      "w-full justify-start font-normal",
                      !formData.birthDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{birthDate ? format(birthDate, dateDisplayFormat) : t("placeholderDate")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={birthDate}
                    onSelect={(d) => handleDateChange("birthDate", d)}
                    captionLayout="dropdown"
                    startMonth={new Date(1600, 0)}
                    endMonth={today}
                    disabled={{ after: today }}
                    locale={isFr ? frLocale : undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>{t("deathDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    aria-invalid={birthAfterDeath || deathInFuture}
                    className={cn(
                      "w-full justify-start font-normal",
                      !formData.deathDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{deathDate ? format(deathDate, dateDisplayFormat) : t("placeholderDate")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deathDate}
                    onSelect={(d) => handleDateChange("deathDate", d)}
                    captionLayout="dropdown"
                    startMonth={new Date(1600, 0)}
                    endMonth={today}
                    disabled={{ after: today }}
                    locale={isFr ? frLocale : undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {birthAfterDeath && <p className="text-xs text-destructive -mt-2">{t("dateOrderError")}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" name="notes" value={formData.notes || ""} onChange={handleChange} rows={3} />
          </div>
        </section>

        <div className="h-px bg-border" />

        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {t("relationships")}
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingRelative(!isAddingRelative)}
              className="text-primary hover:opacity-80 flex items-center gap-1 text-xs font-bold transition-colors"
            >
              <Plus size={14} /> {t("addRelative")}
            </button>
          </div>

          {isAddingRelative && (
            <div className="bg-secondary/50 p-4 rounded-xl mb-4 border border-border shadow-inner space-y-3">
              <div className="flex gap-2 p-1 bg-card rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setRelType("PARENT_CHILD")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    relType === "PARENT_CHILD"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {t("child")}
                </button>
                <button
                  type="button"
                  onClick={() => setRelType("SPOUSE")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    relType === "SPOUSE"
                      ? "bg-pink-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {t("spouse")}
                </button>
              </div>

              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal text-muted-foreground"
                  >
                    {t("searchPeople")}
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={t("searchPeople")}
                      value={relativeSearch}
                      onValueChange={setRelativeSearch}
                    />
                    <CommandList>
                      <CommandEmpty>{t("noResults")}</CommandEmpty>
                      <CommandGroup>
                        {filteredPeople.map((p) => (
                          <CommandItem key={p.id} value={p.id} onSelect={() => handleAddRelationship(p.id)}>
                            <Check className="h-3.5 w-3.5 opacity-0" />
                            {displayName(p, t("unknown"))}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={() => {
                  const id = addPerson({ firstName: "", lastName: "" });
                  handleAddRelationship(id);
                }}
                className="w-full py-1 text-xs text-primary font-bold hover:underline"
              >
                {t("createNewPerson")}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {personRelationships.length > 0 ? (
              personRelationships.map((r) => {
                const otherId = r.fromId === person.id ? r.toId : r.fromId;
                const other = people.find((p) => p.id === otherId);
                if (!other) return null;

                const isChild = r.type === "PARENT_CHILD" && r.fromId === person.id;

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-xl border border-border text-sm group transition-all hover:bg-card hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg",
                          r.type === "SPOUSE" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600",
                        )}
                      >
                        {r.type === "SPOUSE" ? <Heart size={14} /> : <Link size={14} />}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="truncate font-bold text-foreground">{displayName(other, t("unknown"))}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                          {r.type === "SPOUSE" ? t("spouse") : isChild ? t("child") : t("parent")}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteRelationship(r.id)}
                      aria-label={t("noResults")}
                      className="text-muted-foreground/50 hover:text-destructive p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-4">{t("noResults")}</p>
            )}
          </div>
        </section>

        <div className="pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={16} />
                {t("deletePerson")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deletePerson")}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deletePerson(person.id)}>{t("deletePerson")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <ImageCropper
        open={cropperSrc !== null}
        src={cropperSrc}
        initialCrop={cropInitial}
        onCancel={() => {
          setCropperSrc(null);
          setCropSourceImageId(null);
          setCropInitial(undefined);
        }}
        onSave={handleCropSave}
      />
    </div>
  );
};

export default Sidebar;

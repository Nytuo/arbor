import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  ExportOptions,
  Orientation,
  PageLayout,
  PaperFormat,
} from "@/utils/treeExport";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: "pdf" | "svg", opts: ExportOptions) => void;
  defaultTitle: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, onExport, defaultTitle }) => {
  const { t } = useTranslation();
  const [paper, setPaper] = useState<PaperFormat>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [layout, setLayout] = useState<PageLayout>("multi");
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeIndex, setIncludeIndex] = useState(false);
  const [noMargins, setNoMargins] = useState(false);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [includeTileIndicator, setIncludeTileIndicator] = useState(true);
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  const buildOpts = (): ExportOptions => ({
    format: paper,
    orientation,
    layout,
    margin: noMargins ? 0 : 32,
    includeTitle,
    includeIndex,
    transparentBackground,
    includeTileIndicator,
    title,
    subtitle: new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    t,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("exportOptions")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="export-title">{t("title")}</Label>
          <Input id="export-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">{t("general")}</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={includeTitle} onCheckedChange={(v) => setIncludeTitle(v === true)} />
                {t("includeTitle")}
              </label>
            </div>
          </TabsContent>

          <TabsContent value="pdf">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("paperFormat")}</Label>
                <Select value={paper} onValueChange={(v) => setPaper(v as PaperFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="a3">A3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("orientation")}</Label>
                <Select value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("auto")}</SelectItem>
                    <SelectItem value="portrait">{t("portrait")}</SelectItem>
                    <SelectItem value="landscape">{t("landscape")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("pageLayout")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={layout === "single" ? "default" : "outline"}
                  onClick={() => setLayout("single")}
                  className={cn(layout !== "single" && "text-muted-foreground")}
                >
                  {t("singlePage")}
                </Button>
                <Button
                  type="button"
                  variant={layout === "multi" ? "default" : "outline"}
                  onClick={() => setLayout("multi")}
                  className={cn(layout !== "multi" && "text-muted-foreground")}
                >
                  {t("multiPage")}
                </Button>
              </div>
            </div>

            <div className="space-y-2.5">
              <label
                className={cn(
                  "flex items-center gap-2 text-sm text-foreground cursor-pointer",
                  layout !== "multi" && "opacity-50 cursor-not-allowed",
                )}
              >
                <Checkbox
                  checked={includeTileIndicator}
                  disabled={layout !== "multi"}
                  onCheckedChange={(v) => setIncludeTileIndicator(v === true)}
                />
                {t("includeTileIndicator")}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={includeIndex} onCheckedChange={(v) => setIncludeIndex(v === true)} />
                {t("includeIndex")}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={noMargins} onCheckedChange={(v) => setNoMargins(v === true)} />
                {t("noMargins")}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox
                  checked={transparentBackground}
                  onCheckedChange={(v) => setTransparentBackground(v === true)}
                />
                {t("removeBackground")}
              </label>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onExport("svg", buildOpts())}>
            {t("exportSvg")}
          </Button>
          <Button type="button" onClick={() => onExport("pdf", buildOpts())}>
            {t("exportPdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;

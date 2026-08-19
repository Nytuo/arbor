import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTreeStore } from "@/store/useTreeStore";
import {
  Download,
  Upload,
  Trash2,
  FileJson,
  Globe,
  Undo2,
  Redo2,
  UserPlus,
  FolderPlus,
  LayoutGrid,
  FileOutput,
  Grid3x3,
} from "lucide-react";
import { exportToJSON, importFromJSON } from "@/utils/jsonHandler";
import { exportToGedcom, importFromGedcom } from "@/utils/gedcomHandler";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import ExportDialog from "@/components/ExportDialog";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { addPersonAtViewportCenter, addGroupAtViewportCenter, autoArrangeTree } from "@/components/canvas/rete/actions";
import {
  buildLogicalEdges,
  buildTreePdf,
  buildTreeSvg,
  layoutExportNodes,
  type ExportOptions,
} from "@/utils/treeExport";
import { cn } from "@/lib/utils";

interface HeaderProps {
  genGrid: boolean;
  onToggleGenGrid: () => void;
}

const Header: React.FC<HeaderProps> = ({ genGrid, onToggleGenGrid }) => {
  const { people, relationships, groups, importData, resetTree } = useTreeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const [isExporting, setIsExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const exportTitle = useMemo(() => t("appName") + " — " + t("tagline"), [t]);
  const hasPeople = people.length > 0;

  const performExport = useCallback(
    async (format: "pdf" | "svg", opts: ExportOptions) => {
      setDialogOpen(false);
      setIsExporting(true);
      try {
        const logicalEdges = buildLogicalEdges(people, relationships);
        const exportNodes = layoutExportNodes(people, relationships, t);
        if (format === "pdf") {
          const pdf = buildTreePdf(exportNodes, logicalEdges, opts);
          pdf.save("family-tree.pdf");
        } else {
          const svg = buildTreeSvg(exportNodes, logicalEdges, t, {
            title: opts.includeTitle ? opts.title : undefined,
            subtitle: opts.includeTitle ? opts.subtitle : undefined,
          });
          const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "family-tree.svg";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error(err);
        toast.error(t("exportFailed"));
      } finally {
        setIsExporting(false);
      }
    },
    [people, relationships, t],
  );

  const handleExportJSON = () => {
    exportToJSON({ people, relationships, groups });
  };

  const handleExportGedcom = () => {
    exportToGedcom({ people, relationships });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const isJson = file.name.endsWith(".json");
      const isGedcom = file.name.endsWith(".ged") || file.name.endsWith(".gedcom");

      const data = isJson ? importFromJSON(content) : isGedcom ? importFromGedcom(content) : null;
      if (data) {
        importData(data);
        toast.success(t("importSuccess"));
      } else if (isJson || isGedcom) {
        toast.error(t("importFailed"));
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsText(file);
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "fr" ? "en" : "fr");
  };

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between shadow-sm z-20">

      <div className="flex items-center gap-1 overflow-x-auto">
        <Button variant="ghost" size="icon" onClick={() => undo()} disabled={!canUndo} aria-label={t("undo")} title={t("undo")}>
          <Undo2 size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => redo()} disabled={!canRedo} aria-label={t("redo")} title={t("redo")}>
          <Redo2 size={18} />
        </Button>

        <div className="h-6 w-px bg-border mx-1 shrink-0" />

        <Button variant="ghost" onClick={() => addPersonAtViewportCenter()} title="Quick add person (N)">
          <UserPlus size={16} />
          <span className="hidden xl:inline">{t("addPerson")}</span>
        </Button>
        <Button variant="ghost" onClick={() => addGroupAtViewportCenter(t)} disabled={!hasPeople} title={t("addGroupHint")}>
          <FolderPlus size={16} />
          <span className="hidden xl:inline">{t("addGroup")}</span>
        </Button>
        <Button variant="ghost" onClick={() => autoArrangeTree(t)} disabled={!hasPeople} title={t("autoArrange")}>
          <LayoutGrid size={16} />
          <span className="hidden xl:inline">{t("autoArrange")}</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onToggleGenGrid}
          className={cn(genGrid && "bg-indigo-50 text-indigo-600")}
          title={genGrid ? t("genGridOn") : t("genGridOff")}
          aria-pressed={genGrid}
        >
          <Grid3x3 size={16} />
          <span className="hidden xl:inline">{genGrid ? t("genGridOn") : t("genGridOff")}</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => setDialogOpen(true)}
          disabled={isExporting || !hasPeople}
          className="font-bold text-foreground"
          title={t("exportTree")}
        >
          <FileOutput size={16} />
          <span className="hidden xl:inline">{isExporting ? t("exporting") : t("exportTree")}</span>
        </Button>

        <div className="h-6 w-px bg-border mx-1 shrink-0" />

        <Button variant="ghost" onClick={toggleLanguage} className="text-xs font-bold text-muted-foreground">
          <Globe size={14} />
          {i18n.language.toUpperCase().substring(0, 2)}
        </Button>

        <div className="h-6 w-px bg-border mx-1 shrink-0" />

        <Button variant="ghost" onClick={handleExportJSON} title={t("exportJSON")}>
          <FileJson size={18} />
          <span className="hidden lg:inline">JSON</span>
        </Button>

        <Button variant="ghost" onClick={handleExportGedcom} title={t("exportGedcom")}>
          <Download size={18} />
          <span className="hidden lg:inline">GEDCOM</span>
        </Button>

        <Button
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          className="font-bold text-primary hover:text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10"
        >
          <Upload size={18} />
          <span className="hidden sm:inline">{t("import")}</span>
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          accept=".json,.ged,.gedcom"
          className="hidden"
          aria-label={t("import")}
        />

        <div className="h-6 w-px bg-border mx-1 shrink-0" />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" title={t("clearAll")} aria-label={t("clearAll")}>
              <Trash2 size={18} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("clearAll")}</AlertDialogTitle>
              <AlertDialogDescription>{t("clearConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={resetTree}>{t("clearAll")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ExportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onExport={performExport} defaultTitle={exportTitle} />
    </header>
  );
};

export default Header;

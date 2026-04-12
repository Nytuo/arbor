import React, { useRef } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { Download, Upload, Trash2, FileJson, TreePine, Globe } from 'lucide-react';
import { exportToJSON, importFromJSON } from '../utils/jsonHandler';
import { exportToGedcom, importFromGedcom } from '../utils/gedcomHandler';
import { useTranslation } from 'react-i18next';

const Header: React.FC = () => {
  const { people, relationships, importData, resetTree } = useTreeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();

  const handleExportJSON = () => {
    exportToJSON({ people, relationships });
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
      
      if (file.name.endsWith('.json')) {
        const data = importFromJSON(content);
        if (data) importData(data);
      } else if (file.name.endsWith('.ged') || file.name.endsWith('.gedcom')) {
        const data = importFromGedcom(content);
        if (data) importData(data);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');
  };

  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between shadow-sm z-20">
      <div className="flex items-center gap-2">
        <div className="bg-emerald-600 p-1.5 rounded-lg shadow-inner">
          <TreePine className="text-white" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-none">{t('appName')}</h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">{t('tagline')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md transition-all border border-transparent hover:border-slate-200"
        >
          <Globe size={14} />
          {i18n.language.toUpperCase().substring(0, 2)}
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button
          onClick={handleExportJSON}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title={t('exportJSON')}
        >
          <FileJson size={18} />
          <span className="hidden lg:inline">JSON</span>
        </button>
        
        <button
          onClick={handleExportGedcom}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title={t('exportGedcom')}
        >
          <Download size={18} />
          <span className="hidden lg:inline">GEDCOM</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors bg-emerald-50/30 border border-emerald-100"
        >
          <Upload size={18} />
          <span className="hidden sm:inline">{t('import')}</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          accept=".json,.ged,.gedcom"
          className="hidden"
        />

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button
          onClick={() => {
            if (window.confirm(t('clearConfirm'))) {
              resetTree();
            }
          }}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
          title={t('clearAll')}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;

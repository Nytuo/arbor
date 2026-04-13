import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { useTreeStore } from '../store/useTreeStore';
import type { Person, RelationshipType } from '../types';
import { X, Trash2, Plus, Heart, Link, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    deleteRelationship
  } = useTreeStore();
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const placeholder = isFr ? 'JJ/MM/AAAA' : String(t('placeholderDate'));
  const currentYear = new Date().getFullYear();
  const minYear = 1600;
  const minDateObj = new Date(minYear, 0, 1);
  const maxDateObj = new Date();
  const yearDropdownCount = currentYear - minYear + 1;

  const formatForDateInput = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear().toString().padStart(4, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const dd = d.getDate().toString().padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  const person = people.find(p => p.id === selectedPersonId);
  const [formData, setFormData] = useState<Partial<Person>>({});
  const [isAddingRelative, setIsAddingRelative] = useState(false);
  const [relativeSearch, setRelativeSearch] = useState('');
  const [relType, setRelType] = useState<RelationshipType>('PARENT_CHILD');

  useEffect(() => {
    if (person) {
      setFormData(person);
      setIsAddingRelative(false);
    }
  }, [person]);

  if (!selectedPersonId) {
    return (
      <div className="w-80 h-full border-l bg-white p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-slate-800">{t('appName')}</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">{t('selectPersonDesc')}</p>
          <button
          onClick={() => {
            const id = addPerson({ firstName: '', lastName: '' });
            setSelectedPersonId(id);
          }}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 px-4 rounded-xl hover:bg-emerald-700 transition-all shadow-sm font-bold"
        >
          <UserPlus size={18} />
          {t('addPerson')}
        </button>
      </div>
    );
  }

  if (!person) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    updatePerson(person.id, { [name]: value });
  };

  const handleAddRelationship = (targetId: string) => {
    if (targetId === person.id) return;
    
    const exists = relationships.some(r => 
      (r.fromId === person.id && r.toId === targetId && r.type === relType) ||
      (r.fromId === targetId && r.toId === person.id && r.type === relType)
    );

    if (!exists) {
      addRelationship({
        type: relType,
        fromId: person.id,
        toId: targetId
      });
    }
    setIsAddingRelative(false);
  };

  const filteredPeople = people.filter(p => 
    p.id !== person.id && 
    (`${p.firstName} ${p.lastName}`).toLowerCase().includes(relativeSearch.toLowerCase())
  );

  const personRelationships = relationships.filter(r => r.fromId === person.id || r.toId === person.id);

  return (
    <div className="w-80 h-full border-l bg-white shadow-xl overflow-y-auto z-10 flex flex-col border-slate-200">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-20">
        <h2 className="font-bold text-slate-800 truncate pr-2">
          {person.firstName || person.lastName ? `${person.firstName || ''} ${person.lastName || ''}` : t('unknown')}
        </h2>
        <button onClick={() => setSelectedPersonId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <section>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('details')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('firstName')}</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('lastName')}</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('maidenName')}</label>
              <input
                type="text"
                name="maidenName"
                value={formData.maidenName || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('gender')}</label>
              <select
                name="gender"
                value={formData.gender || 'U'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white transition-all appearance-none"
              >
                <option value="U">{t('unknown')}</option>
                <option value="M">{t('male')}</option>
                <option value="F">{t('female')}</option>
                <option value="O">{t('other')}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('birthDate')}</label>
                <DatePicker
                  selected={formData.birthDate ? new Date(formData.birthDate) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? format(date, 'yyyy-MM-dd') : '';
                    setFormData(prev => ({ ...prev, birthDate: value }));
                    updatePerson(person.id, { birthDate: value });
                  }}
                  dateFormat={isFr ? 'dd/MM/yyyy' : 'yyyy-MM-dd'}
                  locale={isFr ? frLocale : undefined}
                  placeholderText={placeholder}
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={minDateObj}
                  maxDate={maxDateObj}
                  yearDropdownItemNumber={yearDropdownCount}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('deathDate')}</label>
                <DatePicker
                  selected={formData.deathDate ? new Date(formData.deathDate) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? format(date, 'yyyy-MM-dd') : '';
                    setFormData(prev => ({ ...prev, deathDate: value }));
                    updatePerson(person.id, { deathDate: value });
                  }}
                  dateFormat={isFr ? 'dd/MM/yyyy' : 'yyyy-MM-dd'}
                  locale={isFr ? frLocale : undefined}
                  placeholderText={placeholder}
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={minDateObj}
                  maxDate={maxDateObj}
                  yearDropdownItemNumber={yearDropdownCount}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('notes')}</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
              />
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t('relationships')}</h3>
            <button 
              onClick={() => setIsAddingRelative(!isAddingRelative)}
              className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-bold transition-colors"
            >
              <Plus size={14} /> {t('addRelative')}
            </button>
          </div>

          {isAddingRelative && (
            <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100 shadow-inner space-y-3">
              <div className="flex gap-2 p-1 bg-white rounded-lg border border-slate-200">
                <button 
                  onClick={() => setRelType('PARENT_CHILD')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${relType === 'PARENT_CHILD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {t('child')}
                </button>
                <button 
                  onClick={() => setRelType('SPOUSE')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${relType === 'SPOUSE' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {t('spouse')}
                </button>
              </div>
              <input
                type="text"
                placeholder={t('searchPeople')}
                value={relativeSearch}
                onChange={(e) => setRelativeSearch(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500 transition-all bg-white"
              />
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                {filteredPeople.length > 0 ? filteredPeople.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddRelationship(p.id)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 transition-colors font-medium text-slate-700"
                  >
                    {p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}` : t('unknown')}
                  </button>
                )) : (
                  <div className="p-3 text-xs text-slate-400 text-center italic">{t('noResults')}</div>
                )}
              </div>
              <button
                onClick={() => {
                  const id = addPerson({ firstName: '', lastName: '' });
                  handleAddRelationship(id);
                }}
                className="w-full py-1 text-xs text-emerald-600 font-bold hover:underline"
              >
                {t('createNewPerson')}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {personRelationships.length > 0 ? personRelationships.map(r => {
              const otherId = r.fromId === person.id ? r.toId : r.fromId;
              const other = people.find(p => p.id === otherId);
              if (!other) return null;

              const isChild = r.type === 'PARENT_CHILD' && r.fromId === person.id;
              const isParent = r.type === 'PARENT_CHILD' && r.toId === person.id;

              return (
                <div key={r.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-sm group transition-all hover:bg-white hover:shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-1.5 rounded-lg ${r.type === 'SPOUSE' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                      {r.type === 'SPOUSE' ? <Heart size={14} /> : <Link size={14} />}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="truncate font-bold text-slate-700">
                        {other.firstName || other.lastName ? `${other.firstName || ''} ${other.lastName || ''}` : t('unknown')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {r.type === 'SPOUSE' ? t('spouse') : (isChild ? t('child') : t('parent'))}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteRelationship(r.id)} className="text-slate-300 hover:text-red-500 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                    <X size={14} />
                  </button>
                </div>
              );
            }) : (
              <p className="text-xs text-slate-400 italic text-center py-4">{t('noResults')}</p>
            )}
          </div>
        </section>

        <div className="pt-6">
          <button
            onClick={() => {
              if (window.confirm(t('deleteConfirm'))) {
                deletePerson(person.id);
              }
            }}
            className="w-full flex items-center justify-center gap-2 text-red-500 border border-red-100 py-2.5 rounded-xl hover:bg-red-50 transition-all text-xs font-bold"
          >
            <Trash2 size={16} />
            {t('deletePerson')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

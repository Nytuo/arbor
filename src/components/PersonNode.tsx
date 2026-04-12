import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { Person } from '../types';
import { User, UserRound, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PersonNode = ({ data, selected }: NodeProps<Person>) => {
  const { firstName, lastName, maidenName, birthDate, deathDate, gender, notes } = data;
  const { t } = useTranslation();

  const getYear = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? dateStr.substring(0, 4) : date.getFullYear().toString();
    } catch {
      return dateStr.substring(0, 4);
    }
  };

  const birthYear = getYear(birthDate);
  const deathYear = getYear(deathDate);
  const lifeSpan = birthYear || deathYear ? `${birthYear} - ${deathYear || ''}` : '';

  const getGenderStyles = () => {
    switch (gender) {
      case 'M': return 'border-blue-200 bg-blue-50/50 text-blue-700';
      case 'F': return 'border-pink-200 bg-pink-50/50 text-pink-700';
      case 'O': return 'border-purple-200 bg-purple-50/50 text-purple-700';
      default: return 'border-slate-200 bg-slate-50/50 text-slate-700';
    }
  };

  const styles = getGenderStyles();

  return (
    <div className={`px-4 py-3 shadow-lg rounded-2xl border-2 bg-white min-w-[180px] transition-all duration-300 ${selected ? 'border-emerald-500 ring-4 ring-emerald-500/10 scale-105 z-50' : 'border-transparent hover:border-slate-200'}`}>
      {/* Top handles for Parents */}
      <Handle type="target" position={Position.Top} id="parent" className="!w-3 !h-3 !bg-slate-300 border-2 border-white" />
      
      <div className="flex items-center gap-3">
        <div className={`rounded-xl w-10 h-10 flex items-center justify-center shrink-0 border shadow-sm ${styles}`}>
          {gender === 'M' ? <User size={20} /> : 
           gender === 'F' ? <UserRound size={20} /> : 
           <Users size={20} />}
        </div>
        <div className="text-left overflow-hidden">
          <div className="text-sm font-bold text-slate-800 truncate leading-tight">
            {firstName || lastName ? `${firstName || ''} ${lastName || ''}` : t('unknown')}
          </div>
          {maidenName ? (
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">{`${t('maidenPrefix')} ${maidenName}`}</div>
          ) : null}
          <div className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-tight uppercase">
            {lifeSpan}
          </div>
          {notes ? (
            (() => {
              const wordsPerLine = 6;
              const words = notes.split(/\s+/).filter(Boolean);
              const lines: string[] = [];
              for (let i = 0; i < words.length; i += wordsPerLine) {
                lines.push(words.slice(i, i + wordsPerLine).join(' '));
              }
              return (
                <div className="mt-1 text-[11px] text-slate-400">
                  {lines.map((line, idx) => (
                    <div key={idx} className="break-words">{line}</div>
                  ))}
                </div>
              );
            })()
          ) : null}
        </div>
      </div>

      {/* Bottom handles for Children */}
      <Handle type="source" position={Position.Bottom} id="child" className="!w-3 !h-3 !bg-slate-300 border-2 border-white" />
      
      {/* Side handles for Spouses */}
      <Handle type="source" position={Position.Right} id="spouse-right" className="!w-3 !h-3 !bg-pink-400 border-2 border-white" />
      <Handle type="target" position={Position.Left} id="spouse-left" className="!w-3 !h-3 !bg-pink-400 border-2 border-white" />
    </div>
  );
};

export default memo(PersonNode);

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Database,
  Filter,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Copy,
  Check,
  Tag,
  Pencil,
  X,
} from 'lucide-react';
import type { DatabaseSchema, DatabaseTable, Column } from '@/lib/types';

type FilterMode = 'all' | 'described' | 'undescribed';

const TYPE_COLORS: Record<string, string> = {
  String: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Float32: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Float64: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Date: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  DateTime: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  UInt8: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  UInt16: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  UInt32: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Int32: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Int64: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Decimal: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
};

function getTypeColor(type: string): string {
  for (const [key, cls] of Object.entries(TYPE_COLORS)) {
    if (type.includes(key)) return cls;
  }
  return 'text-slate-400 bg-slate-800 border-slate-700';
}

export default function DocsClient({ schema }: { schema: DatabaseSchema }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initDb = searchParams.get('db') || schema.databases[0]?.name || '';
  const initTable = searchParams.get('table') || '';

  const [selectedDb, setSelectedDb] = useState(initDb);
  const [selectedTable, setSelectedTable] = useState(initTable);
  const [colSearch, setColSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [editingCol, setEditingCol] = useState<{ table: string; col: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEdit = useCallback((tableName: string, colName: string, current: string) => {
    setEditingCol({ table: tableName, col: colName, value: current === '—' ? '' : current });
    setSaveError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCol(null);
    setSaveError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCol) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/schema', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: editingCol.table,
          column: editingCol.col,
          description: editingCol.value.trim() || '—',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      // Optimistically update the in-memory schema so no full reload is needed
      const db = schema.databases.find(d => d.tables.some(t => t.name === editingCol.table));
      const tbl = db?.tables.find(t => t.name === editingCol.table);
      const col = tbl?.columns.find(c => c.name === editingCol.col);
      if (col) col.description = editingCol.value.trim() || '';
      setEditingCol(null);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }, [editingCol, schema]);

  const currentDb = schema.databases.find(db => db.name === selectedDb);
  const currentTable = currentDb?.tables.find(t => t.name === selectedTable);

  const filteredTables = useMemo(() => {
    if (!currentDb) return [];
    return currentDb.tables.filter(t =>
      !tableSearch || t.name.toLowerCase().includes(tableSearch.toLowerCase())
    );
  }, [currentDb, tableSearch]);

  const filteredColumns = useMemo(() => {
    if (!currentTable) return [];
    return currentTable.columns.filter(col => {
      const matchSearch =
        !colSearch ||
        col.name.toLowerCase().includes(colSearch.toLowerCase()) ||
        col.description.toLowerCase().includes(colSearch.toLowerCase()) ||
        col.type.toLowerCase().includes(colSearch.toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'described' && col.description) ||
        (filter === 'undescribed' && !col.description);
      return matchSearch && matchFilter;
    });
  }, [currentTable, colSearch, filter]);

  function selectDb(name: string) {
    setSelectedDb(name);
    setSelectedTable('');
    setColSearch('');
    setFilter('all');
  }

  function selectTable(name: string) {
    setSelectedTable(name);
    setColSearch('');
    setFilter('all');
    router.replace(`/docs?db=${selectedDb}&table=${name}`, { scroll: false });
  }

  function copyColName(name: string) {
    navigator.clipboard.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(null), 1200);
  }

  const describedCount = currentTable?.columns.filter(c => c.description).length ?? 0;
  const totalCount = currentTable?.totalColumns ?? 0;
  const coverage = totalCount > 0 ? Math.round((describedCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-screen animate-fade-in">
      {/* Panel 1: Databases */}
      <div className="w-44 shrink-0 bg-[#0a0f1e] border-r border-slate-800/60 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-800/60">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Мэдээллийн сан
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {schema.databases.map(db => {
            const isActive = db.name === selectedDb;
            return (
              <button
                key={db.name}
                onClick={() => selectDb(db.name)}
                className={`w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all ${
                  isActive
                    ? 'bg-slate-800/60 border-r-2'
                    : 'hover:bg-slate-800/30 border-r-2 border-transparent'
                }`}
                style={isActive ? { borderRightColor: db.color } : {}}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: db.color,
                    boxShadow: isActive ? `0 0 6px ${db.color}80` : 'none',
                  }}
                />
                <span
                  className={`text-sm font-mono font-semibold truncate ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {db.name}
                </span>
                <span className="ml-auto text-[11px] text-slate-600 shrink-0">
                  {db.tables.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel 2: Tables */}
      <div className="w-52 shrink-0 border-r border-slate-800/60 flex flex-col bg-[#0b1120]">
        <div className="px-3 py-3 border-b border-slate-800/60 space-y-2">
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: currentDb?.color || '#64748b' }}
          >
            {selectedDb || 'Select DB'}
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
            <input
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Хүснэгт хайх…"
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filteredTables.map(table => {
            const isActive = table.name === selectedTable;
            const desc = table.columns.filter(c => c.description).length;
            const pct = table.totalColumns > 0 ? Math.round((desc / table.totalColumns) * 100) : 0;
            return (
              <button
                key={table.name}
                onClick={() => selectTable(table.name)}
                className={`w-full text-left px-3 py-2.5 transition-all border-r-2 ${
                  isActive
                    ? 'bg-slate-800/70 border-r-cyan-400'
                    : 'hover:bg-slate-800/30 border-r-transparent'
                }`}
              >
                <div
                  className={`text-xs font-mono font-semibold truncate mb-1 ${
                    isActive ? 'text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  {table.name}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: currentDb?.color || '#06b6d4',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">{table.totalColumns}</span>
                </div>
              </button>
            );
          })}
          {filteredTables.length === 0 && (
            <div className="px-4 py-6 text-xs text-slate-600 text-center">Хүснэгт олдсонгүй</div>
          )}
        </div>
      </div>

      {/* Panel 3: Columns */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/60 bg-[#0b1120] shrink-0">
          {currentTable ? (
            <>
              <div>
                <span className="font-mono font-bold text-white text-sm">{currentTable.name}</span>
                <span className="text-slate-500 text-xs ml-2">{currentDb?.name}</span>
              </div>
              {/* Coverage pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/50">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: currentDb?.color || '#06b6d4' }}
                />
                <span className="text-xs text-slate-400">
                  {coverage}% · {describedCount}/{totalCount} багана
                </span>
              </div>

              <div className="flex-1" />

              {/* Filter pills */}
              <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1">
                {(['all', 'described', 'undescribed'] as FilterMode[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                      filter === f
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {f === 'all' ? 'Бүгд' : f === 'described' ? 'Тайлбартай' : 'Тайлбаргүй'}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={colSearch}
                  onChange={e => setColSearch(e.target.value)}
                  placeholder="Багана хайх…"
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-44"
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-500">
              ← Хүснэгт сонгоно уу
            </span>
          )}
        </div>

        {/* Column Table */}
        {currentTable ? (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#0b1120] sticky top-0 z-10 border-b border-slate-800/60">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[260px]">
                    Баганын нэр
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[220px]">
                    Төрөл
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Тайлбар
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredColumns.map((col, i) => (
                  <tr
                    key={col.name}
                    className={`border-b border-slate-800/30 hover:bg-slate-800/20 group transition-colors ${
                      i % 2 === 1 ? 'bg-slate-900/20' : ''
                    }`}
                  >
                    <td className="px-5 py-3 w-[260px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-cyan-300 truncate">
                          {col.name}
                        </span>
                        <button
                          onClick={() => copyColName(col.name)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Copy column name"
                        >
                          {copied === col.name ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[220px]">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-mono rounded border ${getTypeColor(
                          col.type
                        )}`}
                      >
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editingCol?.table === currentTable.name && editingCol.col === col.name ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            autoFocus
                            value={editingCol.value}
                            onChange={e => setEditingCol(prev => prev ? { ...prev, value: e.target.value } : prev)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-800 border border-cyan-500/50 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                            placeholder="Тайлбар оруулах…"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
                            >
                              {saving ? 'Хадгалж байна…' : 'Хадгалах'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                            >
                              Болих
                            </button>
                            {saveError && <span className="text-[11px] text-red-400">{saveError}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/desc">
                          {col.description ? (
                            <span className="text-slate-300 text-xs">{col.description}</span>
                          ) : (
                            <span className="text-slate-700 text-xs italic">—</span>
                          )}
                          <button
                            onClick={() => startEdit(currentTable.name, col.name, col.description || '—')}
                            className="opacity-0 group-hover:opacity-100 group/desc-hover:opacity-100 transition-opacity shrink-0 ml-auto"
                            title="Тайлбар засах"
                          >
                            <Pencil className="w-3 h-3 text-slate-500 hover:text-cyan-400 transition-colors" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredColumns.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-slate-600 text-sm">
                      Тохирох багана олдсонгүй
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/40 flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-slate-400 font-medium mb-1">Хүснэгт сонгоогүй байна</h3>
              <p className="text-slate-600 text-sm">
                Зүүн талаас мэдээллийн сан болон хүснэгт сонгоно уу
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

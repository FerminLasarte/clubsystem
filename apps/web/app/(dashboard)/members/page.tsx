"use client";
// apps/web/app/(dashboard)/members/page.tsx

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Users, UserCheck, UserX } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  dni: string | null;
  member_number: string | null;
  joined_at: string | null;
  is_active: boolean;
  role: string;
}

interface MembersResponse {
  items: Member[];
  total: number;
  page: number;
  page_size: number;
}

interface MembersStats {
  total: number;
  active: number;
  inactive: number;
}

function MemberSkeleton() {
  return (
    <tr>
      {[1,2,3,4,5].map(i => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: `${[80,120,100,80,60][i-1]}px` }} />
        </td>
      ))}
    </tr>
  );
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
      active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
    }`}>
      {initials}
    </div>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [stats, setStats] = useState<MembersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMembers = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterActive !== null) params.set("is_active", String(filterActive));

    try {
      const [res, statsRes] = await Promise.all([
        fetch(`${API}/api/v1/users?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/api/v1/users/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!res.ok) throw new Error("Error al cargar socios");
      if (!statsRes.ok) throw new Error("Error al cargar estadísticas de socios");

      setData(await res.json());
      setStats(await statsRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterActive]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Socios</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {stats ? `${stats.total} socio${stats.total !== 1 ? "s" : ""} registrado${stats.total !== 1 ? "s" : ""}` : "Cargando…"}
          </p>
        </div>
        <button 
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <UserPlus className="h-4 w-4" />
          Nuevo socio
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stat pills */}
      <div className="flex gap-3">
        <button
          onClick={() => setFilterActive(null)}
          className={`cursor-pointer flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            filterActive === null ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          }`}
          style={filterActive === null ? { backgroundColor: "var(--color-brand)" } : {}}
        >
          <Users className="h-4 w-4" />
          Todos
          {stats && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${filterActive === null ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{stats.total}</span>}
        </button>
        <button
          onClick={() => setFilterActive(true)}
          className={`cursor-pointer flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            filterActive === true ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          }`}
          style={filterActive === true ? { backgroundColor: "var(--color-brand)" } : {}}
        >
          <UserCheck className="h-4 w-4" />
          Activos
          {stats && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${filterActive === true ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"}`}>{stats.active}</span>}
        </button>
        <button
          onClick={() => setFilterActive(false)}
          className={`cursor-pointer flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            filterActive === false ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          }`}
          style={filterActive === false ? { backgroundColor: "var(--color-brand)" } : {}}
        >
          <UserX className="h-4 w-4" />
          Inactivos
          {stats && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${filterActive === false ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{stats.inactive}</span>}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder="Buscar por nombre, email o número de socio…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 transition"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {["Socio", "N° Socio", "Email", "Teléfono", "Alta", "Estado"].map((h, i) => (
                <th key={h} className={`px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 ${i === 5 ? "text-center" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <MemberSkeleton key={i} />)
              : data?.items.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">
                    {search 
                      ? `Sin resultados para "${search}"` 
                      : filterActive === true 
                        ? "No hay socios activos" 
                        : filterActive === false 
                          ? "No hay socios inactivos" 
                          : "No hay socios registrados"}
                  </td>
                </tr>
              )
              : data?.items.map(member => (
                <tr key={member.id} className="group cursor-pointer hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${member.first_name} ${member.last_name}`} active={member.is_active} />
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </p>
                        {member.dni && (
                          <p className="text-xs text-gray-400">DNI {member.dni}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {member.member_number ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-500 truncate max-w-[180px]">
                    {member.email}
                  </td>
                  <td className="px-6 py-4 text-gray-500 tabular">
                    {member.phone ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-400 tabular text-xs">
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {member.is_active ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                        Inactivo
                      </span>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {/* Footer con total */}
        {data && data.total > 0 && (
          <div className="border-t border-gray-50 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Mostrando {data.items.length} de {data.total} socios
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

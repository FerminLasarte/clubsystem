import React from 'react';

// ─── Datos de Prueba (Mocks) ─────────────────────────────────────────────
// Esto es lo que después vamos a reemplazar por la llamada a tu backend
const mockCourts = [
  { id: 1, name: 'Cancha 1 (Polvo)' },
  { id: 2, name: 'Cancha 2 (Polvo)' },
  { id: 3, name: 'Cancha 3 (Rápida)' },
];

const mockHorarios = ['16:00', '17:30', '19:00', '20:30', '22:00'];

const mockReservas = [
  { court_id: 1, time: '17:30', player: 'Fermín L.', status: 'confirmed' },
  { court_id: 2, time: '19:00', player: 'Torneo Local', status: 'blocked' },
];

// ─── Componente Principal ────────────────────────────────────────────────
export default function ReservationsPage() {
  
  // Función auxiliar para saber si un bloque está reservado
  const getReservation = (courtId: number, time: string) => {
    return mockReservas.find(r => r.court_id === courtId && r.time === time);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera de la página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Grilla de Reservas</h1>
          <p className="text-sm text-gray-500">Gestioná los turnos del club para el día de hoy.</p>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
          + Nuevo Turno
        </button>
      </div>

      {/* Contenedor del Calendario */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-500 w-32">Horario</th>
                {mockCourts.map((court) => (
                  <th key={court.id} className="px-6 py-4 font-medium text-gray-900 text-center border-l">
                    {court.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {mockHorarios.map((time) => (
                <tr key={time} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-500">{time}</td>
                  
                  {mockCourts.map((court) => {
                    const reserva = getReservation(court.id, time);
                    
                    return (
                      <td key={`${court.id}-${time}`} className="p-2 border-l">
                        {reserva ? (
                          <div className={`h-full w-full rounded-lg p-3 flex flex-col justify-center items-center text-center ${
                            reserva.status === 'blocked' 
                              ? 'bg-gray-100 text-gray-600 border border-gray-200' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            <span className="font-semibold">{reserva.player}</span>
                            <span className="text-xs opacity-75 capitalize">{reserva.status}</span>
                          </div>
                        ) : (
                          <button className="h-full w-full min-h-[60px] rounded-lg border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all flex items-center justify-center group">
                            <span className="text-green-600 opacity-0 group-hover:opacity-100 font-medium">
                              Disponible
                            </span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
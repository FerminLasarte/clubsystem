// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  IMPORTANTE — LEER ANTES DE PROBAR EN DISPOSITIVO FÍSICO  ⚠️
// ─────────────────────────────────────────────────────────────────────────────
//
//  Si usás Expo Go en un iPhone/Android real, "localhost" NO funciona porque
//  el dispositivo no puede alcanzar tu computadora por ese nombre.
//
//  DEBES reemplazar la URL de abajo por la IP local de tu computadora:
//
//    1. En macOS, abrí System Preferences → Network → Wi-Fi y copiá la IP.
//       (Ej: 192.168.1.42)
//    2. Asegurate de que el celular y la compu estén en la misma red Wi-Fi.
//    3. Cambiá la línea de API_BASE_URL a:
//
//         export const API_BASE_URL = "http://192.168.X.X:8000";
//
//  Para emulador iOS (Simulator):  http://localhost:8000  ✅ funciona
//  Para emulador Android (AVD):    http://10.0.2.2:8000   ✅ funciona
//  Para dispositivo físico:        http://192.168.X.X:8000 ✅ funciona
//
// ─────────────────────────────────────────────────────────────────────────────

// 👇 Cambiá esta IP por la de tu computadora cuando probés en dispositivo físico
export const API_BASE_URL = "http://192.168.0.241:8000";

export const API_URL = `${API_BASE_URL}/api/v1`;

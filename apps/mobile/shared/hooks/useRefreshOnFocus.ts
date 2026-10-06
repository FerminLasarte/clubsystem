import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Vuelve a pedir los datos cuando la pantalla recupera el foco (por ejemplo al volver de otra pestaña),
 * así una membresía aprobada o una reserva confirmada se ven sin reiniciar la app.
 */
export function useRefreshOnFocus(refetch: () => unknown): void {
  const firstFocus = useRef(true);
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void latest.current();
    }, []),
  );
}

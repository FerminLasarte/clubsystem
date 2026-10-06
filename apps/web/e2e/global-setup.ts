import { seedDatabase } from "./support/backend";

// Cada corrida arranca de la misma base: el flujo modifica reservas, cuotas y caja.
export default function globalSetup() {
  seedDatabase();
}

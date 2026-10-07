import { describe, expect, it } from "vitest";

import { canRequestMembership, membershipLabel, requestLabel } from "./status";

it("membershipLabel habla desde el punto de vista del socio", () => {
  expect(membershipLabel("INVITED")).toBe("Te invitaron");
  expect(membershipLabel("PENDING")).toBe("Solicitud pendiente");
  expect(membershipLabel("APPROVED")).toBe("Sos socio");
  expect(membershipLabel("REJECTED")).toBe("Rechazado");
  expect(membershipLabel("INACTIVE")).toBe("Baja");
});

describe("solicitar membresía", () => {
  it("se puede sin membresía, con una invitación, rechazada o dada de baja", () => {
    expect(canRequestMembership(null)).toBe(true);
    expect(canRequestMembership(undefined)).toBe(true);
    expect(canRequestMembership("INVITED")).toBe(true);
    expect(canRequestMembership("REJECTED")).toBe(true);
    expect(canRequestMembership("INACTIVE")).toBe(true);
  });

  it("no se puede con una solicitud pendiente o siendo socio", () => {
    expect(canRequestMembership("PENDING")).toBe(false);
    expect(canRequestMembership("APPROVED")).toBe(false);
  });

  it("el botón dice qué va a pasar", () => {
    expect(requestLabel(null)).toBe("Solicitar membresía");
    expect(requestLabel("INVITED")).toBe("Aceptar invitación");
    expect(requestLabel("REJECTED")).toBe("Volver a solicitar membresía");
    expect(requestLabel("INACTIVE")).toBe("Volver a solicitar membresía");
  });
});

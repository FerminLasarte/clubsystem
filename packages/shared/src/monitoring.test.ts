import { describe, expect, it } from "vitest";

import { FILTERED, scrubMonitoringEvent } from "./monitoring";

describe("scrubMonitoringEvent", () => {
  it("saca del request el cuerpo, las cookies, la query y el entorno", () => {
    const event = scrubMonitoringEvent({
      request: {
        url: "https://panel.example.com/socios",
        method: "POST",
        data: { dni: "30123456" },
        cookies: { session: "abc" },
        query_string: "token=abc",
        env: { REMOTE_ADDR: "1.2.3.4" },
      },
    });
    expect(event.request).toEqual({ url: "https://panel.example.com/socios", method: "POST" });
  });

  it("deja solo los headers seguros", () => {
    const event = scrubMonitoringEvent({
      request: {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Request-Id": "req-1",
          Authorization: "Bearer abc",
          Cookie: "session=abc",
          "X-Forwarded-For": "1.2.3.4",
        },
      },
    });
    expect(event.request.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Request-Id": "req-1",
    });
  });

  it("filtra los valores de claves sensibles, en cualquier nivel y sin importar mayúsculas", () => {
    const event = scrubMonitoringEvent({
      extra: {
        userEmail: "ana@example.com",
        Password: "secreta",
        refresh_token: "abc",
        member: { dni: 30123456, name: "Ana" },
      },
    });
    expect(event.extra).toEqual({
      userEmail: FILTERED,
      Password: FILTERED,
      refresh_token: FILTERED,
      member: { dni: FILTERED, name: "Ana" },
    });
  });

  it("filtra emails, JWT, bearer, DNI y query strings dentro de textos", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJh";
    const event = scrubMonitoringEvent({
      message: `Falló el alta de ana@example.com con DNI 30.123.456 (o 30123456)`,
      breadcrumbs: [`GET /invitacion?token=abc123 -> 404`, `Authorization: Bearer ${jwt}`, `jwt ${jwt}`],
    });
    expect(event.message).toBe(`Falló el alta de ${FILTERED} con DNI ${FILTERED} (o ${FILTERED})`);
    expect(event.breadcrumbs).toEqual([
      `GET /invitacion${FILTERED} -> 404`,
      `Authorization: ${FILTERED}`,
      `jwt ${FILTERED}`,
    ]);
  });

  it("no toca números que no son un DNI", () => {
    const event = scrubMonitoringEvent({ message: "Reserva 1234 por $8000.00, id a1b2-12345678-c3" });
    expect(event.message).toBe("Reserva 1234 por $8000.00, id a1b2-12345678-c3");
  });

  it("modifica el evento en el lugar y lo devuelve", () => {
    const event = { message: "ana@example.com", level: "error", count: 3 };
    expect(scrubMonitoringEvent(event)).toBe(event);
    expect(event).toEqual({ message: FILTERED, level: "error", count: 3 });
  });
});

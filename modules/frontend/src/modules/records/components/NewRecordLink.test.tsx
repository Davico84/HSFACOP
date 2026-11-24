import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils";
import { useSessionStore } from "@/store/useSessionStore";
import { NewRecordLink } from "./NewRecordLink";

function signIn(readOnly: boolean) {
  useSessionStore.setState({
    accessToken: "tok",
    status: "authenticated",
    user: { id: 1, email: "ana@empresa.test", role: "USER", fullName: "Ana", readOnly },
  });
}

beforeEach(() => {
  server.use(http.get("*/api/orthodontic-records/quota", () => HttpResponse.json({ limit: null, used: 0, reached: false })));
});

describe("NewRecordLink — cuenta vencida", () => {
  it("Con la cuenta vigente muestra 'Nueva historia'", async () => {
    signIn(false);
    renderWithProviders(<NewRecordLink />);

    expect(await screen.findByRole("link", { name: /Nueva historia/ })).toBeInTheDocument();
  });

  it("Aviso y controles: con la cuenta vencida 'Nueva historia' no se muestra", () => {
    signIn(true);
    renderWithProviders(<NewRecordLink />);

    expect(screen.queryByText(/Nueva historia/)).not.toBeInTheDocument();
  });
});

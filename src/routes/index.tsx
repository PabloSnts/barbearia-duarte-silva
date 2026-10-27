import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barbearia — Gestão e Fila" },
      { name: "description", content: "Agenda, clientes, serviços e painel de fila para TV da sua barbearia." },
      { property: "og:title", content: "Barbearia — Gestão e Fila" },
      { property: "og:description", content: "Agenda, clientes, serviços e painel de fila para TV da sua barbearia." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

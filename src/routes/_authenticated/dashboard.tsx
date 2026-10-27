import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Barbearia" },
      { name: "description", content: "Resumo do dia da barbearia." },
      { property: "og:title", content: "Dashboard — Barbearia" },
      { property: "og:description", content: "Resumo do dia da barbearia." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="min-h-screen bg-background bg-surface-glow p-8">
      <h1 className="text-4xl font-semibold text-gold-gradient">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Em construção — as demais telas ainda serão criadas.</p>
    </div>
  );
}

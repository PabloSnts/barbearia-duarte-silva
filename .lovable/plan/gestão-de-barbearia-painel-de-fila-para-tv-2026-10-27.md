# Gestão de Barbearia + Painel de Fila para TV

Sistema premium em modo escuro (grafite/preto fosco, detalhes dourado/âmbar), em português.

## Páginas
- **/auth** — login do barbeiro (e-mail e senha).
- **/ (Dashboard)** — próximo cliente, ocupação do dia, concluídos, horários vagos, atalhos.
- **/agenda** — grade diária e semanal; cards com tags de serviços; botão "Ajustar Horários do Dia" (+/− minutos a partir de um agendamento, prévia, confirmar, desfazer); status (aguardando, em atendimento, concluído).
- **Nova Reserva** — modal acessível de qualquer página: cliente (busca ou novo), múltiplos serviços, soma automática de duração, horário final previsto.
- **/clientes** — cadastro, contatos, histórico de atendimentos.
- **/servicos** — preço, duração (múltiplos de 30), dias da semana e faixas de horário permitidas.
- **/blacklist** — telefone obrigatório, nome com auto-preenchimento a partir de clientes, motivo; tabela e desbloqueio.
- **/configuracoes** — expediente, dias de trabalho/folga, férias, mensagem de ausência, formato do nome na TV (Primeiro nome, Nome e sobrenome, Iniciais, Nome - Serviços).
- **/tv** — tela cheia pública para o lounge: em atendimento + próximos da fila, atualização em tempo real, relógio, mensagem de férias quando aplicável.

## Regras de validação (no servidor e na tela)
- Telefone na blacklist bloqueia reserva com alerta.
- Sem sobreposição em nenhum minuto do bloco total.
- Todos os serviços devem estar permitidos no dia/horário.
- Fora do expediente, em folga ou em férias: bloqueado.
- Duração aceita só múltiplos de 30; campo pode ser apagado e digitado livremente, com erro imediato.
- Ajuste de atraso recalcula início/fim dos seguintes e o horário previsto de encerramento.
- Toasts para salvos, conflitos e erros.

## Técnico
- Lovable Cloud: tabelas clients, services (+ disponibilidade), appointments, appointment_services, blacklist, settings, schedule_adjustments (para desfazer). RLS para usuário autenticado; leitura pública restrita da fila para a TV via função do servidor.
- Realtime nos agendamentos para a TV.
- Validações centralizadas em um módulo puro com testes (sobreposição, soma de duração, múltiplos de 30, disponibilidade, férias, blacklist, ajuste de atraso).
- Endpoint público de webhook para reservas externas, reaproveitando as mesmas validações (com chave secreta).
- Fontes: Cormorant Garamond (títulos) + Manrope (texto).

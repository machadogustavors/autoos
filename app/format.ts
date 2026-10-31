// Data de tela em pt-BR. Entrada inválida não quebra a lista.
export function formatDate(iso?: string): string {
  if (!iso) return 'Data indisponível';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleDateString('pt-BR');
}

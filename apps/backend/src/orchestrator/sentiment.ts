export function analyzeSentiment(message: string): "hot" | "warm" | "cold" {
  const lower = message.toLowerCase();

  const hotSignals = [
    "urgente", "urgência", "preciso hoje", "preciso amanhã", "quanto custa",
    "pode enviar", "fechar", "quero", "preciso", "necessito", "imediato",
    "esta semana", "essa semana",
  ];

  const coldSignals = [
    "só curiosidade", "só pesquisando", "talvez", "futuramente",
    "para o ano", "ainda não sei", "quem sabe",
  ];

  if (hotSignals.some((s) => lower.includes(s))) return "hot";
  if (coldSignals.some((s) => lower.includes(s))) return "cold";
  return "warm";
}

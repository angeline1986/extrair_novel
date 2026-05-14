export async function translateWithOllama(prompt, model = "qwen3:8b") {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 1200,
      },
      system: `
Você é um tradutor profissional EN → PT-BR.

Responda APENAS com a tradução.
Não explique.
Não pense em voz alta.
Não adicione comentários.
Não adicione notas.
Não use markdown.
`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Erro no Ollama: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return data.response?.trim() ?? "";
}
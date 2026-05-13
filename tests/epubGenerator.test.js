// Este arquivo é um ponto de partida para testes automatizados.
// Você pode usar Jest, Ava ou outro framework de sua escolha.

import { buildEpub } from "../src/epub/epubGenerator.js";

// Exemplo mínimo: validar que a função de construção existe.
if (typeof buildEpub !== "function") {
  throw new Error("buildEpub não está exportado corretamente");
}

console.log("Teste inicial de configuração pronto.");

// src/menu/utils.js
// Utilitários para o menu interativo

import readline from 'readline';

export async function askUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
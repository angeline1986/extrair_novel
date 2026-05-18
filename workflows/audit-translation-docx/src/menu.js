#!/usr/bin/env node
// src/menu.js - Ponto de entrada do menu interativo
// Apenas orquestra os módulos

import { main } from './menu/menuOrchestrator.js';

main().catch(console.error);
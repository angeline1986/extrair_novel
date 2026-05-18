#!/usr/bin/env node
// src/fix-gender-issues.js - Ponto de entrada do corretor de gênero

import { main } from './fix-gender/fixGenderOrchestrator.js';

main().catch(console.error);
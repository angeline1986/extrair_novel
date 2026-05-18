// src/versionManager.js
// Arquivo de compatibilidade - redireciona para o novo módulo version/
// DEPRECIADO: Use o módulo version/ diretamente

export { getCurrentStep, setCurrentStep, listVersions, getVersionPath, versionExists } from './version/versionCore.js';
export { createVersionFromCurrent, createVersionFromFile, restoreVersion, gotoVersion, nextVersion, prevVersion, cleanOldVersions } from './version/versionIO.js';
export { showVersionStatus, showHelp } from './version/versionDisplay.js';

export const LANGUAGE_CONFIGS = {
  en: {
    name: 'English',
    residualMarkers: ['the', 'and', 'with', 'that', 'this', 'would', 'could', 'should', 'have', 'been', 'from', 'they', 'their', 'there', 'while', 'after', 'before', 'because'],
    residualThreshold: 8,
    targetLanguage: 'pt'
  },
  es: {
    name: 'Spanish',
    residualMarkers: ['el', 'la', 'los', 'las', 'que', 'con', 'para', 'una', 'no', 'de', 'por', 'como', 'más', 'pero', 'muy', 'todo', 'año', 'años', 'hasta', 'solo', 'aunque', 'donde', 'cuando', 'siempre'],
    residualThreshold: 8,
    targetLanguage: 'pt'
  }
};

export function getLanguageConfig(sourceLang = 'en') {
  return LANGUAGE_CONFIGS[sourceLang] || LANGUAGE_CONFIGS.en;
}

export function getSupportedLanguages() {
  return Object.keys(LANGUAGE_CONFIGS);
}

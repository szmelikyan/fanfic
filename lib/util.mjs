export const today = () => new Date().toISOString().slice(0, 10);

/** Title for matching: lower case, ё → е, Latin letters without diacritics (Huā Chéng → hua cheng; Cyrillic й stays), no quotes or punctuation, single spaces. */
export const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').normalize('NFD').replace(/([a-z])\p{M}+/gu, '$1').normalize('NFC').replace(/[«»"'„“”.,:!?]/g, '').replace(/\s+/g, ' ').trim();

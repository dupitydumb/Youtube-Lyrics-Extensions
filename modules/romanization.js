/**
 * Romanization utility for Korean (Hangul) and Japanese (Kana)
 * Note: Kanji conversion requires a dictionary; we only romanize Hiragana/Katakana.
 */

export const Romanizer = {
  detectLanguage(text) {
    if (!text) return 'unknown';
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code >= 0x3040 && code <= 0x30FF) return 'ja'; // Hiragana/Katakana
      if (code >= 0x4E00 && code <= 0x9FFF) return 'ja'; // Kanji (CJK Unified)
      if (code >= 0xAC00 && code <= 0xD7AF) return 'ko'; // Hangul syllables
    }
    return 'unknown';
  },

  needsRomanization(text) {
    if (!text) return false;
    const lang = this.detectLanguage(text);
    return lang === 'ja' || lang === 'ko';
  },

  romanize(text) {
    const lang = this.detectLanguage(text);
    if (lang === 'ko') return this.romanizeKorean(text);
    if (lang === 'ja') return this.romanizeJapanese(text);
    return '';
  },

  // Simplified Revised Romanization for Hangul
  romanizeKorean(text) {
    // Decompose Hangul syllables to jamo and map to romanization.
    const choseongMap = ['g','gg','n','d','dd','r','m','b','bb','s','ss','','j','jj','ch','k','t','p','h'];
    const jungseongMap = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
    const jongseongMap = ['', 'k','k','ks','n','nj','nh','t','l','lk','lm','lb','ls','lt','lp','lh','m','p','ps','t','t','ng','t','t','k','t','p','t'];

    const base = 0xAC00;
    let out = '';
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const syllableIndex = code - base;
        const choseongIndex = Math.floor(syllableIndex / 588);
        const jungseongIndex = Math.floor((syllableIndex % 588) / 28);
        const jongseongIndex = syllableIndex % 28;
        const c = choseongMap[choseongIndex] || '';
        const v = jungseongMap[jungseongIndex] || '';
        const f = jongseongMap[jongseongIndex] || '';
        out += c + v + f;
      } else {
        out += ch;
      }
    }
    return out.trim();
  },

  // Kana to Romaji (Hepburn-lite). Kanji left as-is.
  romanizeJapanese(text) {
    const map = new Map([
      // Vowels
      ['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],
      ['ア','a'],['イ','i'],['ウ','u'],['エ','e'],['オ','o'],
      // Ka
      ['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],
      ['カ','ka'],['キ','ki'],['ク','ku'],['ケ','ke'],['コ','ko'],
      // Sa
      ['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],
      ['サ','sa'],['シ','shi'],['ス','su'],['セ','se'],['ソ','so'],
      // Ta
      ['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],
      ['タ','ta'],['チ','chi'],['ツ','tsu'],['テ','te'],['ト','to'],
      // Na
      ['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],
      ['ナ','na'],['ニ','ni'],['ヌ','nu'],['ネ','ne'],['ノ','no'],
      // Ha
      ['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],
      ['ハ','ha'],['ヒ','hi'],['フ','fu'],['ヘ','he'],['ホ','ho'],
      // Ma
      ['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],
      ['マ','ma'],['ミ','mi'],['ム','mu'],['メ','me'],['モ','mo'],
      // Ya
      ['や','ya'],['ゆ','yu'],['よ','yo'],['ヤ','ya'],['ユ','yu'],['ヨ','yo'],
      // Ra
      ['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'],
      ['ラ','ra'],['リ','ri'],['ル','ru'],['レ','re'],['ロ','ro'],
      // Wa
      ['わ','wa'],['を','o'],['ん','n'],
      ['ワ','wa'],['ヲ','o'],['ン','n'],
      // Small tsu for gemination handled in code
      ['っ',''],['ッ',''],
      // Long vowel mark
      ['ー','-']
    ]);

    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i+1] || '';
      // Gemination: small tsu doubles next consonant
      if (ch === 'っ' || ch === 'ッ') {
        const nextRomaji = map.get(next) || next;
        const c = (nextRomaji.match(/^[a-z]+/i) || [''])[0];
        out += c ? c[0] : '';
        continue;
      }
      const romaji = map.get(ch);
      if (romaji !== undefined) {
        out += romaji;
      } else {
        out += ch; // Kanji or punctuation
      }
    }
    // Remove standalone long marks
    return out.replace(/-+/g, '').trim();
  }
};

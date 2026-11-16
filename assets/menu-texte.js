/*
 * Casa Rosa : lit le menu de la semaine dicté ou collé par Céline (texte libre, ChatGPT, tableau)
 * et le range jour par jour : entrée, plat, dessert, ou fermé. Utilisé par espace.html.
 * Formats compris : « Lundi / Entrée : … / Plat : … / Dessert : … », « Lundi : velouté, chili, compote »,
 * dictée sans ponctuation (« lundi en entrée … en plat … en dessert … »), « … en entrée », tableau ChatGPT.
 */
(function (root) {
  var L = 'a-zàâäçéèêëîïôöùûüÿœæ';
  var NOT_L = '(?<![' + L + '])';
  var END_L = '(?![' + L + '])';
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MONTH_RE = '(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)';
  var DAY_RE = new RegExp(NOT_L + '(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)' + END_L, 'gi');
  var COURSE_RE = new RegExp(NOT_L + '(entr[ée]es?|plats?(?:\\s+(?:principal|principaux|chaud|du jour))?|desserts?)' + END_L, 'gi');
  var WEEK = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  var CLOSED_RE = /ferm[ée]|f[ée]ri[ée]|pas de (?:service|repas|menu|cuisine)|repos|cong[ée]|vacances/i;

  function monthOf(word) {
    var w = String(word || '').toLowerCase().replace('é', 'e').replace('û', 'u');
    for (var i = 0; i < 12; i++) if (MONTHS[i].replace('é', 'e').replace('û', 'u') === w) return i + 1;
    return null;
  }

  function clean(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
      .replace(/[*_#>`]+/g, ' ')
      .replace(/^[ \t]*(?:[-–—•▪◦●·]|\d{1,2}[.)])[ \t]+/gm, '')
      .replace(/[ \t ]+/g, ' ');
  }

  /** « Semaine du 23 novembre », « du lundi 23 au vendredi 27 novembre », « semaine du 23/11 » → { jour, mois } */
  function weekOf(text) {
    var t = String(text || '').toLowerCase();
    var m = t.match(new RegExp('du\\s+(?:lundi\\s+)?(\\d{1,2})(?:er)?\\s*(?:' + MONTH_RE + '\\s*)?(?:\\d{4}\\s*)?au\\s+(?:vendredi\\s+|samedi\\s+|dimanche\\s+)?(\\d{1,2})(?:er)?\\s*' + MONTH_RE + '?'));
    if (m) return { jour: Number(m[1]), mois: monthOf(m[2] || m[4]) };
    m = t.match(new RegExp('semaine\\s+du\\s+(?:lundi\\s+)?(\\d{1,2})(?:er)?(?:\\s*' + MONTH_RE + '|\\s*[/.-]\\s*(\\d{1,2}))?'));
    if (m) return { jour: Number(m[1]), mois: m[2] ? monthOf(m[2]) : m[3] ? Number(m[3]) : null };
    return null;
  }

  var LEAD = /^(?:c['’]est|ce sera|ce serait|il y a|il y aura|on a|on aura|j['’]ai|je propose|je fais|je vous propose|nous avons|au menu|avec|un|une|des)\s+/i;
  var TRAIL = /\s+(?:et|puis|ensuite|alors|avec|pour|en|comme|enfin|le|la|les|l['’]|un|une|au|du|de|finir|terminer)$/i;

  function dish(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    var prev;
    do {
      prev = s;
      s = s.replace(/^[\s:=>\-–—,.;!?|()«»"“”]+/, '').replace(/[\s:=>\-–—,.;!?|(«»"“”]+$/, '');
      s = s.replace(LEAD, '').replace(TRAIL, '');
      // A closing parenthesis left alone at the end (« velouté (entrée) »)
      if (/\)$/.test(s) && s.split('(').length < s.split(')').length) s = s.slice(0, -1);
    } while (s !== prev);
    if (s.replace(/[^a-zà-ÿ]/gi, '').length < 3) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s.length > 120 ? s.slice(0, 120).replace(/\s+\S*$/, '') : s;
  }

  function courseKey(word) {
    var c = word.charAt(0).toLowerCase();
    return c === 'p' ? 'plat' : c === 'd' ? 'dessert' : 'entree';
  }

  /** One day's text → { entree, plat, dessert, ferme } */
  function parseDay(seg, columns) {
    var out = { entree: '', plat: '', dessert: '', ferme: false };
    // The date right after the day name (« lundi 23 novembre : »)
    seg = seg.replace(new RegExp('^\\s*(?:\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?|\\d{1,2}(?:er)?(?:\\s*' + MONTH_RE + ')?(?:\\s*\\d{4})?)', 'i'), '');
    var ms = [], m;
    COURSE_RE.lastIndex = 0;
    while ((m = COURSE_RE.exec(seg))) ms.push({ key: courseKey(m[1]), start: m.index, end: m.index + m[0].length });
    if (!ms.length) {
      if (CLOSED_RE.test(seg) && seg.replace(/[^a-zà-ÿ]/gi, '').length < 60) { out.ferme = true; return out; }
      var lines = seg.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return /[a-zà-ÿ]/i.test(x); });
      var parts;
      if (/\|/.test(seg)) parts = seg.split('|');
      else if (lines.length >= 2) parts = lines;
      else {
        parts = seg.split(/\s+[·•–—]\s+|\s*;\s*|\s+-\s+|\s*\/\s*/);
        if (parts.filter(function (x) { return /[a-zà-ÿ]/i.test(x); }).length < 3) parts = seg.split(',');
      }
      parts = parts.map(dish).filter(Boolean);
      if (parts.length === 2 && / et /.test(parts[1])) {
        var j = parts[1].lastIndexOf(' et ');
        parts = [parts[0], dish(parts[1].slice(0, j)), dish(parts[1].slice(j + 4))];
      }
      (columns || ['entree', 'plat', 'dessert']).forEach(function (k, i) { if (parts[i]) out[k] = parts[i]; });
      return out;
    }
    // Keyword before the dish (« entrée : velouté ») or after it (« velouté en entrée », « velouté (entrée) »)
    var pre = dish(seg.slice(0, ms[0].start)), post = dish(seg.slice(ms[ms.length - 1].end));
    var postfix = pre && !post;
    ms.forEach(function (x, i) {
      var text = postfix ? seg.slice(i ? ms[i - 1].end : 0, x.start) : seg.slice(x.end, i + 1 < ms.length ? ms[i + 1].start : seg.length);
      var d = dish(text);
      if (d && !out[x.key]) out[x.key] = d;
    });
    return out;
  }

  /** Column order of a ChatGPT table header (« | Jour | Entrée | Plat | Dessert | »), or null */
  function tableColumns(t) {
    var lines = t.split('\n');
    for (var n = 0; n < lines.length; n++) {
      if (!/\|/.test(lines[n])) continue;
      var cells = lines[n].split('|').map(function (c) { return c.trim(); }).filter(Boolean);
      var keys = [];
      cells.forEach(function (c) {
        var k = c.match(new RegExp('^(entr[ée]es?|plats?|desserts?)' + END_L, 'i'));
        if (k) keys.push(courseKey(k[1]));
      });
      if (keys.length >= 2) return keys;
    }
    return null;
  }

  /**
   * Texte complet → { semaine: { jour, mois } | null, jours: [5 × { entree, plat, dessert, ferme }], trouves: nombre de jours lus }
   */
  function parseMenu(text) {
    var t = clean(text);
    var columns = tableColumns(t);
    var hits = [], m;
    DAY_RE.lastIndex = 0;
    while ((m = DAY_RE.exec(t))) hits.push({ day: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
    var jours = WEEK.map(function () { return { entree: '', plat: '', dessert: '', ferme: false }; });
    var found = {};
    hits.forEach(function (h, i) {
      var idx = WEEK.indexOf(h.day);
      if (idx < 0) return;
      var d = parseDay(t.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : t.length), columns);
      var filled = d.entree || d.plat || d.dessert;
      // A day named twice (title « du lundi 23 au vendredi 27 », then the menu): dishes win over an empty or closed mention
      if (filled || (d.ferme && !found[idx])) { jours[idx] = d; found[idx] = true; }
    });
    return { semaine: weekOf(t), jours: jours, trouves: Object.keys(found).length };
  }

  var api = { parseMenu: parseMenu, weekOf: weekOf, dish: dish };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CasaMenu = api;
})(typeof window !== 'undefined' ? window : this);

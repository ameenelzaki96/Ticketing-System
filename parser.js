/* WhatsApp message → ticket fields. Works with Arabic and English messages. */
(function (root) {
  const LABELS = {
    client: /^(client|customer|company|name|client name|customer name|company name|اسم العميل|العميل|الاسم|اسم الشركة|الشركة|المؤسسة|اسم المؤسسة|الجهة)$/i,
    phone: /^(phone|mobile|contact|contact number|number|tel|whatsapp|mob|الجوال|جوال|رقم الجوال|رقم التواصل|التواصل|للتواصل|الرقم|رقم|الهاتف|هاتف|واتساب|المسؤول|رقم المسؤول)$/i,
    locations: /^(location|locations|site|sites|address|city|area|place|installation location|الموقع|المواقع|موقع التركيب|مكان التركيب|العنوان|المدينة|المنطقة|الحي|المكان|اللوكيشن|لوكيشن)$/i,
    devices: /^(devices|device|qty|quantity|units|vehicles|cars|trucks|no\. of devices|number of devices|عدد الأجهزة|عدد الاجهزة|الأجهزة|الاجهزة|عدد السيارات|السيارات|عدد المركبات|المركبات|العدد|عدد)$/i,
    notes: /^(notes|note|remarks|details|comment|ملاحظات|ملاحظة|تفاصيل|التفاصيل)$/i
  };
  const GREETING = /^(السلام عليكم|سلام|مرحبا|مرحباً|هلا|صباح|مساء|hi|hello|hey|dear|good (morning|evening|afternoon)|الله يعطيك العافية|يعطيك العافية)/i;
  const MAP_LINK = /(https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|g\.co\/kgs)[^\s]*)/gi;

  const CITIES = /(الرياض|جدة|جده|مكة|مكه|المدينة المنورة|المدينه|الدمام|الخبر|الظهران|الجبيل|الأحساء|الاحساء|الهفوف|القطيف|الطائف|تبوك|بريدة|بريده|عنيزة|القصيم|حائل|أبها|ابها|خميس مشيط|جازان|جيزان|نجران|الباحة|الباحه|ينبع|الخرج|عرعر|سكاكا|الجوف|رابغ|حفر الباطن|riyadh|jeddah|jedda|makkah|mecca|madinah|medina|dammam|khobar|dhahran|jubail|ahsa|hofuf|qatif|taif|tabuk|buraidah|qassim|hail|abha|khamis|jazan|jizan|najran|yanbu|kharj|arar|sakaka|rabigh|hafar)/i;

  function toLatinDigits(s) {
    return s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
            .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
  }

  function findPhones(text) {
    const out = [];
    const re = /(?:\+|00)?\d[\d \t\-()]{7,16}\d/g;
    let m;
    while ((m = re.exec(text))) {
      let d = m[0].replace(/[^\d+]/g, '');
      if (d.startsWith('00')) d = '+' + d.slice(2);
      const digits = d.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) continue;
      // normalise Saudi mobiles to 05XXXXXXXX
      let n = d;
      if (/^\+?9665\d{8}$/.test(d)) n = '0' + d.replace(/^\+?966/, '');
      else if (/^5\d{8}$/.test(d)) n = '0' + d;
      if (!out.includes(n)) out.push(n);
    }
    return out;
  }

  function splitLabel(line) {
    // "Key: value", "Key - value", "Key : value", "*Key*: value"
    const m = line.match(/^[\s*_•\-–]*([^:：\-–]{2,30}?)[\s*_]*[:：\-–]\s*(.*)$/);
    if (!m) return null;
    const key = m[1].replace(/[*_]/g, '').trim();
    for (const f in LABELS) if (LABELS[f].test(key)) return { field: f, value: m[2].trim() };
    return null;
  }

  function cleanLine(l) {
    return l
      .replace(/^\[[^\]]{4,40}\]\s*[^:]{1,40}:\s*/, '')            // [23/11/2026, 7:11 PM] Sender:
      .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(\s?[AP]M)?\s+-\s+[^:]{1,40}:\s*/i, '') // 23/11/26, 19:11 - Sender:
      .replace(/[‎‏‪-‮]/g, '')
      .trim();
  }

  function parse(raw) {
    const text = toLatinDigits(String(raw || ''));
    const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
    const res = { client: '', phone: '', locations: [], devices: '', notes: [] };
    let current = null; // field a header line opened (value on following lines)
    const loose = [];

    for (const line of lines) {
      const lab = splitLabel(line);
      if (lab) {
        current = lab.field;
        if (lab.value) addTo(res, lab.field, lab.value);
        continue;
      }
      if (current === 'locations' || current === 'notes') { addTo(res, current, line.replace(/^[\s*•\-–\d.)]+/, '')); continue; }
      if (current && !res[current]) { addTo(res, current, line); current = null; continue; }
      current = null;
      loose.push(line);
    }

    // map links anywhere are locations
    (text.match(MAP_LINK) || []).forEach(u => { if (!res.locations.some(l => l.includes(u))) res.locations.push(u); });

    // no labelled location: lines mentioning a city
    if (!res.locations.length) {
      loose.forEach(l => { if (CITIES.test(l) && !/https?:\/\//.test(l)) res.locations.push(l); });
    }

    // phone: labelled first, else first number found anywhere
    const phones = findPhones(res.phone || '').concat(findPhones(text));
    res.phone = phones[0] || res.phone;
    res.otherPhones = phones.filter(p => p !== res.phone).filter((p, i, a) => a.indexOf(p) === i);

    // devices: "5 devices", "٣ أجهزة", "10 سيارات"
    if (!res.devices) {
      const m = text.match(/(\d{1,4})\s*(devices?|units?|vehicles?|cars?|trucks?|أجهزة|اجهزة|جهاز|سيارات|سيارة|مركبات|مركبة|شاحنات|شاحنة)/i);
      if (m) res.devices = m[1];
    } else {
      const m = res.devices.match(/\d+/); if (m) res.devices = m[0];
    }

    // client fallback: first loose line that isn't a greeting, phone, link or long sentence
    if (!res.client) {
      const cand = loose.find(l => !GREETING.test(l) && !/https?:\/\//.test(l) &&
        findPhones(l).length === 0 && l.length <= 60 && !/^\d+$/.test(l));
      if (cand) res.client = cand.replace(/^[*_]+|[*_]+$/g, '');
    }

    // remaining loose lines (minus greeting/client/phones) become notes
    loose.forEach(l => {
      if (l === res.client || GREETING.test(l) || MAP_LINK.test(l)) { MAP_LINK.lastIndex = 0; return; }
      MAP_LINK.lastIndex = 0;
      if (findPhones(l).length && l.replace(/[\d\s+\-()]/g, '').length < 3) return;
      res.notes.push(l);
    });

    return {
      client: res.client.trim(),
      phone: res.phone,
      otherPhones: res.otherPhones,
      locations: res.locations.map(s => s.trim()).filter(Boolean).join('\n'),
      devices: res.devices,
      notes: res.notes.join('\n')
    };
  }

  function addTo(res, f, v) {
    v = v.replace(/^[*_]+|[*_]+$/g, '').trim();
    if (!v) return;
    if (f === 'locations' || f === 'notes') res[f].push(v);
    else if (f === 'phone') res.phone = res.phone ? res.phone + ' ' + v : v;
    else if (!res[f]) res[f] = v;
  }

  const api = { parse, findPhones, toLatinDigits };
  if (typeof module !== 'undefined') module.exports = api; else root.WAParser = api;
})(this);

(function(){
  const ROMAJI_PHRASE_MAP = [
    ['ご予約から当日までの流れ','go-yoyaku-kara-tojitsu-made-no-nagare'],
    ['よくあるご質問','yoku-aru-go-shitsumon'],
    ['ご利用料金の目安','goriyo-ryokin-no-meyasu'],
    ['ご利用者様・ご家族様の声','goriyosha-sama-go-kazoku-sama-no-koe'],
    ['代表挨拶・サービスへの想い','daihyo-aisatsu-service-eno-omoi'],
    ['事業所案内・最新の活動状況','jigyosho-annai-saishin-no-katsudo-jokyo'],
    ['千葉市全域','chiba-city'],
    ['四街道市','yotsukaido-city'],
    ['市原市','ichihara-city'],
    ['介護タクシー','kaigo-taxi'],
    ['福祉タクシー','fukushi-taxi'],
    ['公式line','official-line'],
    ['公式LINE','official-line'],
    ['line','line'],
    ['q&a','qa'],
    ['Q&A','qa'],
    ['q＆a','qa'],
    ['Q＆A','qa'],
    ['24時間365日対応','24h-365days'],
    ['料金表','price'],
    ['料金','price'],
    ['問合せ','contact'],
    ['お問い合わせ','contact'],
    ['予約','reserve'],
    ['ご予約','reserve'],
    ['流れ','nagare'],
    ['よくある','yoku-aru'],
    ['質問','shitsumon'],
    ['開業','kaigyo'],
    ['パートナー募集','partner-boshu'],
    ['サービス','service'],
    ['案内','annai'],
    ['活動状況','katsudo-jokyo'],
    ['車両紹介','vehicle-introduction'],
    ['乗車定員について','capacity'],
    ['安心の対応機材ラインナップ','equipment-lineup'],
    ['幅広いご利用シーン','usage-scenes'],
    ['ちばケアタクシーが選ばれる理由','reason-chiba-care-taxi']
  ];

  const HIRAGANA_DIGRAPH_MAP = {
    'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
    'しゃ':'sha','しゅ':'shu','しょ':'sho',
    'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
    'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
    'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
    'みゃ':'mya','みゅ':'myu','みょ':'myo',
    'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
    'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
    'じゃ':'ja','じゅ':'ju','じょ':'jo',
    'びゃ':'bya','びゅ':'byu','びょ':'byo',
    'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
    'ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo','ゔゅ':'vyu'
  };

  const HIRAGANA_MAP = {
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo',
    'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'wo','ん':'n',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
    'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
    'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
    'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
    'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
    'ゃ':'ya','ゅ':'yu','ょ':'yo','っ':'','ゔ':'vu',
    'ー':'-'
  };

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function ensureTopButtons(list, defaults){
    const items = Array.isArray(list) ? list.slice(0, 3) : [];
    while(items.length < 3){
      items.push({ text:"", link:"#", visible:true });
    }
    return items.map((item, index) => ({
      text: item?.text || defaults[index] || `ボタン${index + 1}`,
      link: item?.link || "#",
      visible: item?.visible !== false
    }));
  }

  function ensureFooterButtons(list, defaults){
    const items = Array.isArray(list) ? list.slice(0, 3) : [];
    while(items.length < 3){
      items.push({ text:"", link:"#", visible:true, image:"" });
    }
    return items.map((item, index) => ({
      text: item?.text || defaults[index] || `ボタン${index + 1}`,
      link: item?.link || "#",
      visible: item?.visible !== false,
      image: item?.image || ""
    }));
  }

  function digitsOnlyPhone(value){
    return String(value || "").replace(/[^0-9+]/g, "");
  }

  function formatPhoneNumberForDisplay(value){
    const text = String(value || "").trim();
    if(!text) return "";
    const digits = text.replace(/[^0-9]/g, "");
    if(/^0\d{9,10}$/.test(digits)){
      if(digits.length === 10){
        return digits.replace(/(\d{2,4})(\d{2,4})(\d{4})/, "$1-$2-$3");
      }
      if(digits.length === 11){
        return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
      }
    }
    return text;
  }

  function buildPcTopPhoneFallback(config){
    const phoneButton = config && Array.isArray(config.footer) ? config.footer[0] : null;
    const rawLink = phoneButton && phoneButton.link ? String(phoneButton.link).trim() : "";
    const fallbackDigits = digitsOnlyPhone(rawLink.replace(/^tel:/i, ""));
    return {
      enabled: !!(phoneButton && phoneButton.visible !== false && rawLink),
      label: "📞 電話予約",
      number: fallbackDigits ? formatPhoneNumberForDisplay(fallbackDigits) : "",
      link: rawLink || (fallbackDigits ? ("tel:" + fallbackDigits) : "")
    };
  }

  function ensurePcTopPhoneShape(config){
    const fallback = buildPcTopPhoneFallback(config);
    const current = config && config.pcTopPhone && typeof config.pcTopPhone === "object" ? config.pcTopPhone : {};
    const numberValue = String(current.number || fallback.number || "").trim();
    const linkValue = String(current.link || fallback.link || "").trim();
    return {
      enabled: current.enabled === true || (current.enabled == null && fallback.enabled === true),
      label: String(current.label || fallback.label || "📞 電話予約").trim() || "📞 電話予約",
      number: numberValue || formatPhoneNumberForDisplay(digitsOnlyPhone(linkValue.replace(/^tel:/i, ""))),
      link: linkValue || (numberValue ? ("tel:" + digitsOnlyPhone(numberValue)) : fallback.link || "")
    };
  }

  function ensureConfigShape(config){
    const topDefaults = ["ボタン1", "ボタン2", "ボタン3"];
    const footerDefaults = ["電話", "LINE", "予約"];

    config.buttons = ensureTopButtons(config.buttons, topDefaults);
    config.buttonsPc = ensureTopButtons(config.buttonsPc || config.buttons, topDefaults);
    config.footer = ensureFooterButtons(config.footer, footerDefaults);
    config.footerPc = ensureFooterButtons(config.footerPc || config.footer, footerDefaults);
    config.pcTopPhone = ensurePcTopPhoneShape(config);

    config.logoImage = config.logoImage || "";
    config.headerBgColor = config.headerBgColor || "#ffffff";
    config.footerBgColor = config.footerBgColor || "#ffffff";
    return config;
  }

  function ensureSectionLinks(section){
    if(!Array.isArray(section.links)){
      section.links = [];
    }
    while(section.links.length < 3){
      section.links.push({
        text: "",
        url: "#",
        visible: false
      });
    }
    section.links = section.links.slice(0, 3).map((link) => ({
      text: link?.text || "",
      url: link?.url || "#",
      visible: link?.visible === true
    }));
    return section.links;
  }

  function katakanaToHiragana(text){
    return String(text || '').replace(/[\u30a1-\u30f6]/g, function(char){
      return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
  }

  function replaceKnownJapanesePhrases(text){
    let value = String(text || '');
    const list = ROMAJI_PHRASE_MAP.slice().sort((a, b) => b[0].length - a[0].length);

    list.forEach(([jp, romaji]) => {
      value = value.split(jp).join(' ' + romaji + ' ');
    });

    return value;
  }

  function romanizeKana(text){
    let value = katakanaToHiragana(text);
    let result = '';

    for(let i = 0; i < value.length; i++){
      const current = value[i];
      const next = value[i + 1] || '';
      const pair = current + next;

      if(current === 'っ'){
        let nextRomaji = '';
        if(HIRAGANA_DIGRAPH_MAP[pair]){
          nextRomaji = HIRAGANA_DIGRAPH_MAP[pair];
        }else if(HIRAGANA_MAP[next]){
          nextRomaji = HIRAGANA_MAP[next];
        }
        if(nextRomaji){
          result += nextRomaji.charAt(0);
        }
        continue;
      }

      if(HIRAGANA_DIGRAPH_MAP[pair]){
        result += HIRAGANA_DIGRAPH_MAP[pair];
        i++;
        continue;
      }

      if(HIRAGANA_MAP[current]){
        result += HIRAGANA_MAP[current];
        continue;
      }

      result += current;
    }

    return result;
  }

  function slugifySectionId(text){
    let value = String(text || "").trim();
    value = value.normalize('NFKC');
    value = replaceKnownJapanesePhrases(value);
    value = value.replace(/&/g, ' and ');
    value = value.replace(/[／/]/g, ' ');
    value = value.replace(/[・･]/g, ' ');
    value = value.replace(/[【】「」『』（）()\[\]]/g, ' ');
    value = romanizeKana(value);
    value = value.toLowerCase();
    value = value.replace(/[^a-z0-9]+/g, '-');
    value = value.replace(/-+/g, '-');
    value = value.replace(/^-+|-+$/g, '');

    if(!value){
      value = 'section';
    }
    if(/^\d/.test(value)){
      value = 'section-' + value;
    }
    return value;
  }

  function ensureUniqueSectionIds(sections){
    const used = new Set();

    return sections.map((section, idx) => {
      let current = String(section?.sectionId || "").trim();

      if(!current){
        current = slugifySectionId(section?.title || section?.type || `section-${idx + 1}`);
      }else{
        current = slugifySectionId(current);
      }

      let unique = current;
      let count = 2;
      while(used.has(unique)){
        unique = `${current}-${count}`;
        count++;
      }
      used.add(unique);
      section.sectionId = slugifySectionId(unique);
      return section;
    });
  }

  function ensureSectionShape(section, idx){
    if(!section || typeof section !== "object"){
      section = {
        id: "section-" + idx,
        sectionId: "",
        type: "normal",
        enabled: true,
        title: "",
        text: "",
        image: "",
        link: "#",
        textSize: "medium",
        bgColor: "#ffffff",
        alignY: "middle",
        titleAlign: "left",
        textAlign: "left",
        menuGroups: []
      };
    }

    section.id = section.id || ("section-" + idx);
    section.sectionId = section.sectionId || "";
    section.type = section.type || "normal";
    section.enabled = section.enabled !== false;
    section.title = section.title || "";
    section.text = section.text || "";
    section.image = section.image || "";
    section.link = section.link || "#";
    section.textSize = section.textSize || "medium";
    section.bgColor = section.bgColor || "#ffffff";
    section.alignY = section.alignY || "middle";
    section.titleAlign = section.titleAlign || "left";
    section.textAlign = section.textAlign || "left";

    if(!Array.isArray(section.images)) section.images = [];
    if(!Array.isArray(section.items)) section.items = [];
    if(!Array.isArray(section.menuGroups)) section.menuGroups = [];

    if(Array.isArray(section.items)){
      section.items = section.items.map((item) => ({
        title: item?.title || "",
        text: item?.text || "",
        image: item?.image || "",
        link: item?.link || "#"
      }));
    }

    if(Array.isArray(section.menuGroups)){
      section.menuGroups = section.menuGroups.map((group, groupIndex) => ({
        title: group?.title || `カテゴリ${groupIndex + 1}`,
        open: group?.open !== false,
        items: Array.isArray(group?.items) ? group.items.map((item) => ({
          name: item?.name || "",
          price: item?.price || "",
          description: item?.description || "",
          visible: item?.visible !== false
        })) : []
      }));
    }

    ensureSectionLinks(section);
    return section;
  }

  function getSectionAnchorAttr(section){
    let id = String(section?.sectionId || "").trim();
    if(!id) return "";
    id = slugifySectionId(id);
    return ` id="${escapeAttr(id)}"`;
  }

  function applyTopButton(el, data, fallbackText){
    el.innerText = data?.text || fallbackText;
    el.href = data?.link || "#";
    if(data?.visible === false){
      el.classList.add("hidden");
    }else{
      el.classList.remove("hidden");
    }
  }

  function applyFooterButton(anchorEl, imgEl, textEl, data, fallbackText){
    textEl.innerText = data?.text || fallbackText;
    anchorEl.href = data?.link || "#";

    if(data?.visible === false){
      anchorEl.classList.add("hidden");
    }else{
      anchorEl.classList.remove("hidden");
    }

    if(data?.image){
      imgEl.src = data.image;
      imgEl.classList.remove("hidden");
    }else{
      imgEl.src = "";
      imgEl.classList.add("hidden");
    }
  }

  function wrapLink(link, innerHtml, className = ""){
    if(link && link !== "#"){
      return `<a href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer" class="${escapeAttr(className)}">${innerHtml}</a>`;
    }
    return innerHtml;
  }

  window.IndexUtils = {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    ensureConfigShape: ensureConfigShape,
    ensureSectionLinks: ensureSectionLinks,
    slugifySectionId: slugifySectionId,
    ensureUniqueSectionIds: ensureUniqueSectionIds,
    ensureSectionShape: ensureSectionShape,
    getSectionAnchorAttr: getSectionAnchorAttr,
    applyTopButton: applyTopButton,
    applyFooterButton: applyFooterButton,
    wrapLink: wrapLink
  };
})();

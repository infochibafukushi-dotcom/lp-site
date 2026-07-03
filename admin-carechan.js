(function(){
  const CARECHAN_PATH = "data/carechan.json";

  let carechanDraft = null;
  let carechanLoadedImage = null;

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function setCarechanStatus(message, type){
    const box = document.getElementById("carechanSaveResult");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function parsePath(pathStr){
    return String(pathStr || "").split(".").filter(function(p){ return p !== ""; }).map(Number);
  }

  function pathToString(pathArr){
    return pathArr.join(".");
  }

  function getNodeContext(pathArr){
    if(!carechanDraft || !Array.isArray(pathArr)) return null;
    let list = carechanDraft.questions;
    let node = null;
    for(let i = 0; i < pathArr.length; i++){
      node = list[pathArr[i]];
      if(!node) return null;
      if(i < pathArr.length - 1){
        if(!Array.isArray(node.children)) node.children = [];
        list = node.children;
      }
    }
    return { node: node, list: list, index: pathArr[pathArr.length - 1] };
  }

  function getGitHubSettings(){
    const owner = document.getElementById("githubOwner")?.value.trim() || "";
    const repo = document.getElementById("githubRepo")?.value.trim() || "";
    const branch = document.getElementById("githubBranch")?.value.trim() || "main";
    const token = document.getElementById("githubToken")?.value.trim() || "";
    if(!owner || !repo || !branch || !token){
      throw new Error("GitHub接続設定をすべて入力してください。");
    }
    return { owner, repo, branch, token };
  }

  function utf8ToBase64(str){
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function getCurrentFileSha(owner, repo, branch, token, path){
    const url = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + encodeURIComponent(branch);
    const res = await fetch(url, {
      headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" }
    });
    if(res.status === 404) return null;
    if(!res.ok) throw new Error("SHA取得失敗: " + res.status);
    return (await res.json()).sha;
  }

  async function saveFileToGitHub(path, contentString){
    const { owner, repo, branch, token } = getGitHubSettings();
    const contentBase64 = utf8ToBase64(contentString);
    const apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;

    async function putWithSha(sha){
      const payload = {
        message: "Update " + path + " from admin panel (carechan)",
        content: contentBase64,
        branch: branch
      };
      if(sha) payload.sha = sha;
      return fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: "token " + token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    }

    let sha = await getCurrentFileSha(owner, repo, branch, token, path);
    let res = await putWithSha(sha);
    let result = await res.json();
    if(!res.ok && (res.status === 409 || res.status === 422)){
      sha = await getCurrentFileSha(owner, repo, branch, token, path);
      res = await putWithSha(sha);
      result = await res.json();
    }
    if(!res.ok) throw new Error(result?.message || (res.status + " " + res.statusText));
    return result;
  }

  function sanitizeFileName(name){
    return String(name || "image").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  }

  function buildCarechanAssetPath(fileName){
    return "./assets/carechan/" + Date.now() + "-" + sanitizeFileName(fileName);
  }

  function toStoredAssetPath(rawUrl){
    const raw = String(rawUrl || "").trim();
    if(!raw) return "./assets/carechan/carechan-default.svg";
    if(raw.startsWith("data:")) return raw;
    if(raw.startsWith("./") || raw.startsWith("/")) return raw;
    try{
      const { owner, repo, branch } = getGitHubSettings();
      const rawPrefix = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/";
      if(raw.startsWith(rawPrefix)){
        return "./" + raw.slice(rawPrefix.length);
      }
    }catch(error){}
    if(/^https?:\/\//i.test(raw)) return raw;
    return "./" + raw.replace(/^\.\//, "");
  }

  function withPreviewCacheBuster(url){
    const raw = String(url || "").trim();
    if(!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
    const versionMatch = raw.match(/\/(\d{13})-/);
    const version = versionMatch ? versionMatch[1] : String(Date.now());
    return raw + (raw.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version);
  }

  function updateCarechanCharacterPreview(url){
    const preview = document.getElementById("carechanCharacterPreview");
    if(!preview) return;
    const raw = String(url || "").trim();
    if(!raw){
      preview.innerHTML = "未設定";
      return;
    }
    preview.innerHTML = '<img src="' + escapeHtml(withPreviewCacheBuster(raw)) + '" alt="preview" style="max-width:80px;max-height:80px;">';
  }

  function setCarechanCharacterImagePath(path){
    if(!carechanDraft) carechanDraft = ensureCarechanDraft({});
    const stored = toStoredAssetPath(path);
    carechanDraft.character.image = stored;
    const input = document.getElementById("carechanCharacterImage");
    if(input) input.value = stored;
    updateCarechanCharacterPreview(stored);
  }

  function getDroppedImageFile(event){
    const files = event?.dataTransfer?.files;
    if(!files || !files.length) return null;
    for(let i = 0; i < files.length; i++){
      const file = files[i];
      if(file && String(file.type || "").startsWith("image/")) return file;
    }
    return null;
  }

  async function fileToBase64(file){
    return new Promise(function(resolve, reject){
      const reader = new FileReader();
      reader.onload = function(){
        resolve(String(reader.result || "").split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadCarechanAsset(file){
    const { owner, repo, branch, token } = getGitHubSettings();
    const storedPath = buildCarechanAssetPath(file.name);
    const githubPath = storedPath.replace(/^\.\//, "");
    const res = await fetch("https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + githubPath, {
      method: "PUT",
      headers: {
        Authorization: "token " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Upload " + githubPath + " from admin panel (carechan)",
        content: await fileToBase64(file),
        branch: branch
      })
    });
    const result = await res.json();
    if(!res.ok) throw new Error(result?.message || "upload failed");
    return storedPath;
  }

  function normalizeNode(node, idx, isRoot){
    node.id = node.id || ("q-" + Date.now() + "-" + idx);
    node.enabled = node.enabled !== false;
    if(isRoot) node.order = idx + 1;
    node.title = node.title || "";
    node.menuPrompt = node.menuPrompt || "";
    node.answer = node.answer || "";
    node.ctas = Array.isArray(node.ctas) ? node.ctas : [];
    node.children = Array.isArray(node.children) ? node.children : [];
    node.ctas.forEach(function(c, cIdx){
      c.id = c.id || ("cta-" + node.id + "-" + cIdx);
      c.label = c.label || "";
      c.url = c.url || "#";
      c.order = cIdx + 1;
      c.visible = c.visible !== false;
    });
    node.children.forEach(function(child, cIdx){
      normalizeNode(child, cIdx, false);
    });
  }

  function normalizeQuestionTree(data){
    if(!data || !Array.isArray(data.questions)) return;
    data.questions.forEach(function(q, idx){
      normalizeNode(q, idx, true);
    });
  }

  function ensureCarechanDraft(raw){
    const data = raw && typeof raw === "object" ? deepClone(raw) : {};
    data.enabled = data.enabled === true;
    data.version = data.version || 2;
    data.character = data.character || {};
    data.character.image = toStoredAssetPath(data.character.image || "./assets/carechan/carechan-default.svg");
    data.character.alt = data.character.alt || "ケアちゃん";
    data.character.imageVersion = Number(data.character.imageVersion) || 0;
    data.speechBubbles = data.speechBubbles || {};
    data.speechBubbles.mode = data.speechBubbles.mode === "fixed" ? "fixed" : "random";
    data.speechBubbles.items = Array.isArray(data.speechBubbles.items) && data.speechBubbles.items.length
      ? data.speechBubbles.items.map(String) : ["質問してね♪"];
    data.speechBubbles.fixedIndex = Number(data.speechBubbles.fixedIndex) || 0;
    data.greeting = data.greeting || {};
    data.greeting.title = data.greeting.title || "こんにちは！";
    data.greeting.subtitle = data.greeting.subtitle || "ケアちゃんです♪";
    data.greeting.prompt = data.greeting.prompt || "何について知りたいですか？";
    data.position = data.position || {};
    data.position.mobile = data.position.mobile || { bottomOffsetFromFooter: 60, right: 14 };
    data.position.desktop = data.position.desktop || { bottom: 24, right: 24 };
    data.questions = Array.isArray(data.questions) ? data.questions : [];
    data.meta = data.meta || { storeId: "default" };
    data.extensions = data.extensions || { ai: { enabled: false } };
    normalizeQuestionTree(data);
    return data;
  }

  async function fetchLpConfigUrls(){
    if(window.CarechanCtaDefaults){
      return window.CarechanCtaDefaults.fetchConfigUrls();
    }
    const res = await fetch("./data/config.json?" + Date.now());
    if(!res.ok) throw new Error("config.json 読込失敗");
    const config = await res.json();
    const footer = Array.isArray(config.footer) ? config.footer : [];
    const buttons = Array.isArray(config.buttons) ? config.buttons : [];
    return {
      phone: String(footer[0]?.link || "").trim(),
      line: String(footer[1]?.link || "").trim(),
      reservation: String(footer[2]?.link || "").trim(),
      contact: String(buttons[0]?.link || "").trim()
    };
  }

  async function hydrateDefaultCtasFromConfig(){
    if(!carechanDraft || !window.CarechanCtaDefaults) return 0;
    const urls = await window.CarechanCtaDefaults.fetchConfigUrls();
    return window.CarechanCtaDefaults.applyDefaultCtasToQuestions(carechanDraft.questions, urls);
  }

  async function loadCarechanDraft(){
    const res = await fetch("./" + CARECHAN_PATH + "?" + Date.now());
    if(!res.ok) throw new Error("carechan.json 読込失敗");
    carechanDraft = ensureCarechanDraft(await res.json());
    carechanLoadedImage = carechanDraft.character.image;
    try{
      await hydrateDefaultCtasFromConfig();
    }catch(error){
      setCarechanStatus("carechan.json を読み込みました（CTA自動設定はスキップ: " + error.message + "）", "warn");
      renderCarechanEditor();
      return;
    }
    renderCarechanEditor();
    setCarechanStatus("carechan.json を読み込みました。", "success");
  }

  function collectCarechanDraftFromForm(){
    if(!carechanDraft) carechanDraft = ensureCarechanDraft({});
    carechanDraft.enabled = document.getElementById("carechanEnabled")?.checked === true;
    const nextImage = toStoredAssetPath(
      document.getElementById("carechanCharacterImage")?.value.trim() || "./assets/carechan/carechan-default.svg"
    );
    carechanDraft.character.image = nextImage;
    carechanDraft.character.alt = document.getElementById("carechanCharacterAlt")?.value.trim() || "ケアちゃん";
    carechanDraft.speechBubbles.mode = document.getElementById("carechanBubbleMode")?.value === "fixed" ? "fixed" : "random";
    carechanDraft.speechBubbles.fixedIndex = Number(document.getElementById("carechanBubbleFixedIndex")?.value) || 0;
    const bubbleRaw = document.getElementById("carechanBubbleItems")?.value || "";
    carechanDraft.speechBubbles.items = bubbleRaw.split("\n").map(function(s){ return s.trim(); }).filter(Boolean);
    if(!carechanDraft.speechBubbles.items.length) carechanDraft.speechBubbles.items = ["質問してね♪"];
    carechanDraft.greeting.title = document.getElementById("carechanGreetingTitle")?.value.trim() || "";
    carechanDraft.greeting.subtitle = document.getElementById("carechanGreetingSubtitle")?.value.trim() || "";
    carechanDraft.greeting.prompt = document.getElementById("carechanGreetingPrompt")?.value.trim() || "";
    carechanDraft.position.mobile.bottomOffsetFromFooter = Number(document.getElementById("carechanMobileOffset")?.value) || 60;
    carechanDraft.position.mobile.right = Number(document.getElementById("carechanMobileRight")?.value) || 14;
    carechanDraft.position.desktop.bottom = Number(document.getElementById("carechanDesktopBottom")?.value) || 24;
    carechanDraft.position.desktop.right = Number(document.getElementById("carechanDesktopRight")?.value) || 24;
    return carechanDraft;
  }

  function syncNodeFromDom(pathStr){
    const ctx = getNodeContext(parsePath(pathStr));
    if(!ctx || !ctx.node) return;
    const node = ctx.node;
    node.enabled = document.querySelector('[data-q-enabled="' + pathStr + '"]')?.checked !== false;
    node.title = document.querySelector('[data-q-title="' + pathStr + '"]')?.value || "";
    node.menuPrompt = document.querySelector('[data-q-menu-prompt="' + pathStr + '"]')?.value || "";
    node.answer = document.querySelector('[data-q-answer="' + pathStr + '"]')?.value || "";
    node.ctas.forEach(function(c, cIdx){
      c.label = document.querySelector('[data-cta-label="' + pathStr + '"][data-cta-index="' + cIdx + '"]')?.value || "";
      c.url = document.querySelector('[data-cta-url="' + pathStr + '"][data-cta-index="' + cIdx + '"]')?.value || "#";
      c.visible = document.querySelector('[data-cta-visible="' + pathStr + '"][data-cta-index="' + cIdx + '"]')?.checked !== false;
    });
  }

  function syncQuestionsFromDom(){
    if(!carechanDraft) return;
    document.querySelectorAll("[data-q-title]").forEach(function(el){
      syncNodeFromDom(el.getAttribute("data-q-title"));
    });
  }

  function renderCtaEditor(node, pathStr){
    return node.ctas.map(function(cta, cIndex){
      return (
        '<div class="card-item-editor" style="margin-top:8px;padding:10px;background:#fff;border:1px dashed #ccc;border-radius:8px;">' +
          '<div class="row"><label>表示名</label>' +
          '<input type="text" data-cta-label="' + pathStr + '" data-cta-index="' + cIndex + '" value="' + escapeHtml(cta.label) + '"></div>' +
          '<div class="row"><label>URL</label>' +
          '<input type="text" data-cta-url="' + pathStr + '" data-cta-index="' + cIndex + '" value="' + escapeHtml(cta.url) + '"></div>' +
          '<div class="actions">' +
            '<label><input type="checkbox" data-cta-visible="' + pathStr + '" data-cta-index="' + cIndex + '"' + (cta.visible !== false ? " checked" : "") + '> 表示</label>' +
            '<button type="button" class="secondary small-btn" data-cta-up="' + pathStr + '" data-cta-index="' + cIndex + '">↑</button>' +
            '<button type="button" class="secondary small-btn" data-cta-down="' + pathStr + '" data-cta-index="' + cIndex + '">↓</button>' +
            '<button type="button" class="danger small-btn" data-cta-remove="' + pathStr + '" data-cta-index="' + cIndex + '">削除</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderTreeNode(node, pathArr, depth){
    const pathStr = pathToString(pathArr);
    const depthLabel = depth === 0 ? ("Q" + (pathArr[0] + 1)) : ("└ " + node.title);
    const moveButtons = depth === 0
      ? '<button type="button" class="secondary small-btn" data-q-up="' + pathStr + '">↑</button>' +
        '<button type="button" class="secondary small-btn" data-q-down="' + pathStr + '">↓</button>'
      : '<button type="button" class="secondary small-btn" data-child-up="' + pathStr + '">↑</button>' +
        '<button type="button" class="secondary small-btn" data-child-down="' + pathStr + '">↓</button>';

    const childrenHtml = (node.children || []).map(function(child, cIdx){
      return renderTreeNode(child, pathArr.concat([cIdx]), depth + 1);
    }).join("");

    return (
      '<div class="carechan-tree-node" style="margin-left:' + (depth * 18) + 'px;margin-bottom:12px;border-left:2px solid #e87f00;padding-left:12px;">' +
        '<div style="padding:14px 16px;background:#fcfcfc;border:1px solid #ddd;border-radius:12px;">' +
          '<div class="actions" style="margin-bottom:10px;flex-wrap:wrap;">' +
            '<strong>' + escapeHtml(depth === 0 ? depthLabel : ("子: " + (node.title || "無題"))) + '</strong>' +
            moveButtons +
            '<button type="button" class="danger small-btn" data-q-remove="' + pathStr + '">削除</button>' +
          '</div>' +
          '<div class="row"><label>有効</label>' +
          '<label><input type="checkbox" data-q-enabled="' + pathStr + '"' + (node.enabled !== false ? " checked" : "") + '> 表示する</label></div>' +
          '<div class="row"><label>タイトル</label>' +
          '<input type="text" data-q-title="' + pathStr + '" value="' + escapeHtml(node.title) + '"></div>' +
          '<div class="row"><label>サブメニュー文言（子がある場合）</label>' +
          '<input type="text" data-q-menu-prompt="' + pathStr + '" value="' + escapeHtml(node.menuPrompt) + '" placeholder="例: 何をしたいですか？"></div>' +
          '<div class="row"><label>回答文（末端項目）</label>' +
          '<textarea data-q-answer="' + pathStr + '" rows="4">' + escapeHtml(node.answer) + '</textarea></div>' +
          '<div class="row"><label>CTAボタン</label>' +
          '<div class="actions">' +
            '<button type="button" class="linklike small-btn" data-cta-add="' + pathStr + '">+ CTA追加</button>' +
            '<button type="button" class="linklike small-btn" data-cta-load-config="' + pathStr + '">既存設定から読み込む</button>' +
          '</div></div>' +
          '<div data-cta-box="' + pathStr + '">' + renderCtaEditor(node, pathStr) + '</div>' +
          '<div class="actions" style="margin-top:10px;">' +
            '<button type="button" class="secondary small-btn" data-child-add="' + pathStr + '">+ 子質問を追加</button>' +
          '</div>' +
          (childrenHtml ? '<div class="carechan-tree-children" style="margin-top:12px;">' + childrenHtml + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function renderQuestionEditor(){
    const box = document.getElementById("carechanQuestionsEditor");
    if(!box || !carechanDraft) return;
    box.innerHTML = carechanDraft.questions.map(function(q, idx){
      return renderTreeNode(q, [idx], 0);
    }).join("") || '<p class="note">質問がありません。「質問を追加」から追加してください。</p>';
  }

  function moveSibling(pathArr, dir){
    syncQuestionsFromDom();
    const ctx = getNodeContext(pathArr);
    if(!ctx) return;
    const next = ctx.index + dir;
    if(next < 0 || next >= ctx.list.length) return;
    const tmp = ctx.list[ctx.index];
    ctx.list[ctx.index] = ctx.list[next];
    ctx.list[next] = tmp;
    normalizeQuestionTree(carechanDraft);
    renderCarechanEditor();
  }

  function removeNode(pathArr){
    syncQuestionsFromDom();
    const ctx = getNodeContext(pathArr);
    if(!ctx) return;
    ctx.list.splice(ctx.index, 1);
    normalizeQuestionTree(carechanDraft);
    renderCarechanEditor();
  }

  function addChildNode(pathStr){
    syncQuestionsFromDom();
    const ctx = getNodeContext(parsePath(pathStr));
    if(!ctx || !ctx.node) return;
    if(!Array.isArray(ctx.node.children)) ctx.node.children = [];
    ctx.node.children.push({
      id: "q-" + Date.now(),
      enabled: true,
      title: "新しい子質問",
      menuPrompt: "",
      answer: "（回答を入力してください）",
      ctas: [],
      children: []
    });
    normalizeQuestionTree(carechanDraft);
    renderCarechanEditor();
  }

  function addCta(pathStr){
    syncQuestionsFromDom();
    const ctx = getNodeContext(parsePath(pathStr));
    if(!ctx || !ctx.node) return;
    ctx.node.ctas.push({
      id: "cta-" + Date.now(),
      label: "ボタン",
      url: "#",
      order: ctx.node.ctas.length + 1,
      visible: true
    });
    normalizeQuestionTree(carechanDraft);
    renderCarechanEditor();
  }

  function moveCta(pathStr, cIndex, dir){
    syncQuestionsFromDom();
    const ctx = getNodeContext(parsePath(pathStr));
    if(!ctx || !ctx.node) return;
    const ctas = ctx.node.ctas;
    const next = cIndex + dir;
    if(next < 0 || next >= ctas.length) return;
    const tmp = ctas[cIndex];
    ctas[cIndex] = ctas[next];
    ctas[next] = tmp;
    normalizeQuestionTree(carechanDraft);
    renderCarechanEditor();
  }

  async function loadCtasFromLpConfig(pathStr){
    try{
      syncQuestionsFromDom();
      const ctx = getNodeContext(parsePath(pathStr));
      if(!ctx || !ctx.node) return;
      const urls = await fetchLpConfigUrls();
      let added = 0;
      if(window.CarechanCtaDefaults){
        added = window.CarechanCtaDefaults.applyManualCtasToNode(ctx.node, urls);
      }
      normalizeQuestionTree(carechanDraft);
      renderCarechanEditor();
      setCarechanStatus(
        added
          ? "電話・LINE・ネット予約・お問い合わせのCTAを追加しました"
          : "追加可能なCTAはありませんでした",
        added ? "success" : "warn"
      );
    }catch(error){
      setCarechanStatus("既存設定の読込失敗: " + error.message, "error");
    }
  }

  function renderCarechanEditor(){
    if(!carechanDraft) return;
    const d = carechanDraft;
    document.getElementById("carechanEnabled").checked = d.enabled === true;
    document.getElementById("carechanCharacterImage").value = d.character.image || "";
    document.getElementById("carechanCharacterAlt").value = d.character.alt || "";
    updateCarechanCharacterPreview(d.character.image || "");
    document.getElementById("carechanBubbleMode").value = d.speechBubbles.mode || "random";
    document.getElementById("carechanBubbleFixedIndex").value = d.speechBubbles.fixedIndex || 0;
    document.getElementById("carechanBubbleItems").value = (d.speechBubbles.items || []).join("\n");
    document.getElementById("carechanGreetingTitle").value = d.greeting.title || "";
    document.getElementById("carechanGreetingSubtitle").value = d.greeting.subtitle || "";
    document.getElementById("carechanGreetingPrompt").value = d.greeting.prompt || "";
    document.getElementById("carechanMobileOffset").value = d.position.mobile.bottomOffsetFromFooter || 60;
    document.getElementById("carechanMobileRight").value = d.position.mobile.right || 14;
    document.getElementById("carechanDesktopBottom").value = d.position.desktop.bottom || 24;
    document.getElementById("carechanDesktopRight").value = d.position.desktop.right || 24;
    renderQuestionEditor();
    bindCarechanEditorEvents();
    if(window.AdminCollapse && typeof window.AdminCollapse.bindWithin === "function"){
      window.AdminCollapse.bindWithin(document.getElementById("card-carechan-settings"));
    }
  }

  function bindCarechanEditorEvents(){
    const root = document.getElementById("carechanQuestionsEditor");
    if(!root) return;

    root.onclick = function(event){
      const up = event.target.closest("[data-q-up]");
      if(up){ moveSibling(parsePath(up.getAttribute("data-q-up")), -1); return; }
      const down = event.target.closest("[data-q-down]");
      if(down){ moveSibling(parsePath(down.getAttribute("data-q-down")), 1); return; }
      const cup = event.target.closest("[data-child-up]");
      if(cup){ moveSibling(parsePath(cup.getAttribute("data-child-up")), -1); return; }
      const cdown = event.target.closest("[data-child-down]");
      if(cdown){ moveSibling(parsePath(cdown.getAttribute("data-child-down")), 1); return; }

      const remove = event.target.closest("[data-q-remove]");
      if(remove){
        if(!confirm("この項目を削除しますか？（子質問も削除されます）")) return;
        removeNode(parsePath(remove.getAttribute("data-q-remove")));
        return;
      }

      const childAdd = event.target.closest("[data-child-add]");
      if(childAdd){ addChildNode(childAdd.getAttribute("data-child-add")); return; }

      const ctaAdd = event.target.closest("[data-cta-add]");
      if(ctaAdd){ addCta(ctaAdd.getAttribute("data-cta-add")); return; }

      const ctaLoad = event.target.closest("[data-cta-load-config]");
      if(ctaLoad){
        loadCtasFromLpConfig(ctaLoad.getAttribute("data-cta-load-config"));
        return;
      }

      const ctaRemove = event.target.closest("[data-cta-remove]");
      if(ctaRemove){
        syncQuestionsFromDom();
        const pathStr = ctaRemove.getAttribute("data-cta-remove");
        const cIdx = Number(ctaRemove.getAttribute("data-cta-index"));
        const ctx = getNodeContext(parsePath(pathStr));
        if(ctx && ctx.node) ctx.node.ctas.splice(cIdx, 1);
        normalizeQuestionTree(carechanDraft);
        renderCarechanEditor();
        return;
      }

      const ctaUp = event.target.closest("[data-cta-up]");
      if(ctaUp){ moveCta(ctaUp.getAttribute("data-cta-up"), Number(ctaUp.getAttribute("data-cta-index")), -1); return; }
      const ctaDown = event.target.closest("[data-cta-down]");
      if(ctaDown){ moveCta(ctaDown.getAttribute("data-cta-down"), Number(ctaDown.getAttribute("data-cta-index")), 1); }
    };
  }

  async function applyCarechanCharacterFile(file){
    if(!file) return;
    const previousPath = carechanDraft?.character?.image || "./assets/carechan/carechan-default.svg";
    let previewUrl = "";
    try{
      previewUrl = URL.createObjectURL(file);
      updateCarechanCharacterPreview(previewUrl);
      setCarechanStatus("キャラクター画像をアップロード中...", "warn");
      const storedPath = await uploadCarechanAsset(file);
      setCarechanCharacterImagePath(storedPath);
      carechanDraft.character.imageVersion = Date.now();
      setCarechanStatus("画像アップロード成功。carechan.json を保存してください。", "success");
    }catch(error){
      setCarechanCharacterImagePath(previousPath);
      setCarechanStatus("画像アップロード失敗: " + error.message, "error");
    }finally{
      if(previewUrl) URL.revokeObjectURL(previewUrl);
    }
  }

  async function uploadCarechanCharacter(input){
    try{
      const file = input.files?.[0];
      await applyCarechanCharacterFile(file);
    }finally{
      if(input) input.value = "";
    }
  }

  function bindCarechanCharacterImageUi(){
    const uploadInput = document.getElementById("carechanCharacterUpload");
    const imageInput = document.getElementById("carechanCharacterImage");
    const dropZone = document.getElementById("carechanCharacterDropZone");

    uploadInput?.addEventListener("change", function(e){
      uploadCarechanCharacter(e.target);
    });

    imageInput?.addEventListener("input", function(){
      setCarechanCharacterImagePath(imageInput.value);
    });

    if(!dropZone || dropZone.dataset.carechanDropBound === "true") return;
    dropZone.dataset.carechanDropBound = "true";

    ["dragenter", "dragover"].forEach(function(type){
      dropZone.addEventListener(type, function(event){
        const file = getDroppedImageFile(event);
        if(!file) return;
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add("is-dragover");
      });
    });

    dropZone.addEventListener("dragleave", function(event){
      const related = event.relatedTarget;
      if(related && dropZone.contains(related)) return;
      dropZone.classList.remove("is-dragover");
    });

    dropZone.addEventListener("drop", function(event){
      const file = getDroppedImageFile(event);
      if(!file) return;
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("is-dragover");
      applyCarechanCharacterFile(file);
    });
  }

  function addCarechanQuestion(){
    if(!carechanDraft) return;
    syncQuestionsFromDom();
    carechanDraft.questions.push({
      id: "q-" + Date.now(),
      enabled: true,
      order: carechanDraft.questions.length + 1,
      title: "新しい質問",
      menuPrompt: "",
      answer: "（回答を入力してください）",
      ctas: [],
      children: []
    });
    normalizeQuestionTree(carechanDraft);
    renderCarechanEditor();
  }

  async function saveCarechanToGitHub(isSilent){
    try{
      if(!isSilent) setCarechanStatus("保存中...", "warn");
      collectCarechanDraftFromForm();
      syncQuestionsFromDom();
      await hydrateDefaultCtasFromConfig();
      normalizeQuestionTree(carechanDraft);
      carechanDraft.character.image = toStoredAssetPath(carechanDraft.character.image);
      if(String(carechanDraft.character.image || "").startsWith("blob:")){
        throw new Error("画像アップロードが完了していません。ファイルを選び直してから保存してください。");
      }
      if(carechanDraft.character.image !== carechanLoadedImage){
        carechanDraft.character.imageVersion = Date.now();
      }
      if(!Number(carechanDraft.character.imageVersion)){
        carechanDraft.character.imageVersion = Date.now();
      }
      await saveFileToGitHub(CARECHAN_PATH, JSON.stringify(carechanDraft, null, 2));
      carechanLoadedImage = carechanDraft.character.image;
      renderCarechanEditor();
      if(!isSilent){
        setCarechanStatus("carechan.json の保存が完了しました。", "success");
      }
      return true;
    }catch(error){
      console.error('[admin] saveCarechanToGitHub failed:', error);
      if(!isSilent) setCarechanStatus("保存失敗: " + error.message, "error");
      return false;
    }
  }

  function bindCarechanAdminUi(){
    document.getElementById("carechanReloadBtn")?.addEventListener("click", function(){
      loadCarechanDraft().catch(function(e){ setCarechanStatus(e.message, "error"); });
    });
    document.getElementById("carechanSaveBtn")?.addEventListener("click", function(){
      saveCarechanToGitHub(false);
    });
    document.getElementById("carechanAddQuestionBtn")?.addEventListener("click", addCarechanQuestion);
    bindCarechanCharacterImageUi();
  }

  async function initCarechanAdmin(){
    bindCarechanAdminUi();
    try{
      await loadCarechanDraft();
    }catch(error){
      carechanDraft = ensureCarechanDraft({ enabled: false, questions: [] });
      try{
        await hydrateDefaultCtasFromConfig();
      }catch(hydrateError){}
      renderCarechanEditor();
      setCarechanStatus("carechan.json が未作成の可能性があります。保存で新規作成できます。", "warn");
    }
  }

  window.saveCarechanToGitHub = saveCarechanToGitHub;
  window.uploadCarechanCharacter = uploadCarechanCharacter;
  window.addCarechanQuestion = addCarechanQuestion;
  window.loadCarechanDraft = loadCarechanDraft;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initCarechanAdmin);
  }else{
    initCarechanAdmin();
  }
})();

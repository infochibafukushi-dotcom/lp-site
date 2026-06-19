(function(){
  const CARECHAN_PATH = "data/carechan.json";

  let carechanDraft = null;

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
      headers: {
        Authorization: "token " + token,
        Accept: "application/vnd.github+json"
      }
    });
    if(res.status === 404) return null;
    if(!res.ok) throw new Error("SHA取得失敗: " + res.status);
    const data = await res.json();
    return data.sha;
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
    if(!res.ok){
      throw new Error(result?.message || (res.status + " " + res.statusText));
    }
    return result;
  }

  function sanitizeFileName(name){
    return String(name || "image").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  }

  async function fileToBase64(file){
    return new Promise(function(resolve, reject){
      const reader = new FileReader();
      reader.onload = function(){
        const result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadCarechanAsset(file){
    const { owner, repo, branch, token } = getGitHubSettings();
    const safeName = sanitizeFileName(file.name);
    const path = "assets/carechan/" + Date.now() + "-" + safeName;
    const contentBase64 = await fileToBase64(file);
    const apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: "token " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Upload " + path + " from admin panel (carechan)",
        content: contentBase64,
        branch: branch
      })
    });
    const result = await res.json();
    if(!res.ok) throw new Error(result?.message || "upload failed");
    return "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/" + path;
  }

  function ensureCarechanDraft(raw){
    const data = raw && typeof raw === "object" ? deepClone(raw) : {};
    data.enabled = data.enabled === true;
    data.version = data.version || 1;
    data.character = data.character || {};
    data.character.image = data.character.image || "./assets/carechan/carechan-default.svg";
    data.character.alt = data.character.alt || "ケアちゃん";
    data.speechBubbles = data.speechBubbles || {};
    data.speechBubbles.mode = data.speechBubbles.mode === "fixed" ? "fixed" : "random";
    data.speechBubbles.items = Array.isArray(data.speechBubbles.items) && data.speechBubbles.items.length
      ? data.speechBubbles.items.map(String)
      : ["質問してね♪"];
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
    normalizeQuestionOrders();
    return data;
  }

  function normalizeQuestionOrders(){
    carechanDraft.questions.forEach(function(q, idx){
      q.id = q.id || ("q-" + Date.now() + "-" + idx);
      q.enabled = q.enabled !== false;
      q.order = idx + 1;
      q.title = q.title || "";
      q.answer = q.answer || "";
      q.ctas = Array.isArray(q.ctas) ? q.ctas : [];
      q.ctas.forEach(function(c, cIdx){
        c.id = c.id || ("cta-" + q.id + "-" + cIdx);
        c.label = c.label || "";
        c.url = c.url || "#";
        c.order = cIdx + 1;
        c.visible = c.visible !== false;
      });
    });
  }

  async function loadCarechanDraft(){
    const res = await fetch("./" + CARECHAN_PATH + "?" + Date.now());
    if(!res.ok) throw new Error("carechan.json 読込失敗");
    carechanDraft = ensureCarechanDraft(await res.json());
    renderCarechanEditor();
    setCarechanStatus("carechan.json を読み込みました。", "success");
  }

  function collectCarechanDraftFromForm(){
    if(!carechanDraft) carechanDraft = ensureCarechanDraft({});

    carechanDraft.enabled = document.getElementById("carechanEnabled")?.checked === true;
    carechanDraft.character.image = document.getElementById("carechanCharacterImage")?.value.trim() || "./assets/carechan/carechan-default.svg";
    carechanDraft.character.alt = document.getElementById("carechanCharacterAlt")?.value.trim() || "ケアちゃん";
    carechanDraft.speechBubbles.mode = document.getElementById("carechanBubbleMode")?.value === "fixed" ? "fixed" : "random";
    carechanDraft.speechBubbles.fixedIndex = Number(document.getElementById("carechanBubbleFixedIndex")?.value) || 0;

    const bubbleRaw = document.getElementById("carechanBubbleItems")?.value || "";
    carechanDraft.speechBubbles.items = bubbleRaw.split("\n").map(function(s){ return s.trim(); }).filter(Boolean);
    if(!carechanDraft.speechBubbles.items.length){
      carechanDraft.speechBubbles.items = ["質問してね♪"];
    }

    carechanDraft.greeting.title = document.getElementById("carechanGreetingTitle")?.value.trim() || "";
    carechanDraft.greeting.subtitle = document.getElementById("carechanGreetingSubtitle")?.value.trim() || "";
    carechanDraft.greeting.prompt = document.getElementById("carechanGreetingPrompt")?.value.trim() || "";

    carechanDraft.position.mobile.bottomOffsetFromFooter = Number(document.getElementById("carechanMobileOffset")?.value) || 60;
    carechanDraft.position.mobile.right = Number(document.getElementById("carechanMobileRight")?.value) || 14;
    carechanDraft.position.desktop.bottom = Number(document.getElementById("carechanDesktopBottom")?.value) || 24;
    carechanDraft.position.desktop.right = Number(document.getElementById("carechanDesktopRight")?.value) || 24;

    return carechanDraft;
  }

  function renderCtaEditor(question, qIndex){
    return question.ctas.map(function(cta, cIndex){
      return (
        '<div class="card-item-editor" style="margin-top:8px;padding:10px;background:#fff;border:1px dashed #ccc;border-radius:8px;">' +
          '<div class="row"><label>ボタン表示名</label>' +
          '<input type="text" data-carechan-cta-label="' + qIndex + '" data-cta-index="' + cIndex + '" value="' + escapeHtml(cta.label) + '"></div>' +
          '<div class="row"><label>URL</label>' +
          '<input type="text" data-carechan-cta-url="' + qIndex + '" data-cta-index="' + cIndex + '" value="' + escapeHtml(cta.url) + '"></div>' +
          '<div class="actions">' +
            '<label><input type="checkbox" data-carechan-cta-visible="' + qIndex + '" data-cta-index="' + cIndex + '"' + (cta.visible !== false ? " checked" : "") + '> 表示</label>' +
            '<button type="button" class="secondary small-btn" data-carechan-cta-up="' + qIndex + '" data-cta-index="' + cIndex + '">↑</button>' +
            '<button type="button" class="secondary small-btn" data-carechan-cta-down="' + qIndex + '" data-cta-index="' + cIndex + '">↓</button>' +
            '<button type="button" class="danger small-btn" data-carechan-cta-remove="' + qIndex + '" data-cta-index="' + cIndex + '">削除</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderQuestionEditor(){
    const box = document.getElementById("carechanQuestionsEditor");
    if(!box || !carechanDraft) return;

    box.innerHTML = carechanDraft.questions.map(function(q, qIndex){
      return (
        '<div class="section-item" style="margin-bottom:12px;">' +
          '<div style="padding:14px 16px;background:#fcfcfc;border:1px solid #ddd;border-radius:12px;">' +
            '<div class="actions" style="margin-bottom:10px;">' +
              '<strong>Q' + (qIndex + 1) + '</strong>' +
              '<button type="button" class="secondary small-btn" data-carechan-q-up="' + qIndex + '">↑</button>' +
              '<button type="button" class="secondary small-btn" data-carechan-q-down="' + qIndex + '">↓</button>' +
              '<button type="button" class="danger small-btn" data-carechan-q-remove="' + qIndex + '">削除</button>' +
            '</div>' +
            '<div class="row"><label>有効</label>' +
            '<label><input type="checkbox" data-carechan-q-enabled="' + qIndex + '"' + (q.enabled !== false ? " checked" : "") + '> 表示する</label></div>' +
            '<div class="row"><label>質問タイトル</label>' +
            '<input type="text" data-carechan-q-title="' + qIndex + '" value="' + escapeHtml(q.title) + '"></div>' +
            '<div class="row"><label>回答文</label>' +
            '<textarea data-carechan-q-answer="' + qIndex + '" rows="5">' + escapeHtml(q.answer) + '</textarea></div>' +
            '<div class="row"><label>CTAボタン</label>' +
            '<button type="button" class="linklike small-btn" data-carechan-cta-add="' + qIndex + '">+ CTA追加</button></div>' +
            '<div data-carechan-cta-box="' + qIndex + '">' + renderCtaEditor(q, qIndex) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("") || '<p class="note">質問がありません。「質問を追加」から追加してください。</p>';
  }

  function syncQuestionsFromDom(){
    if(!carechanDraft) return;
    carechanDraft.questions.forEach(function(q, qIndex){
      q.enabled = document.querySelector('[data-carechan-q-enabled="' + qIndex + '"]')?.checked !== false;
      q.title = document.querySelector('[data-carechan-q-title="' + qIndex + '"]')?.value || "";
      q.answer = document.querySelector('[data-carechan-q-answer="' + qIndex + '"]')?.value || "";
      q.ctas.forEach(function(c, cIndex){
        c.label = document.querySelector('[data-carechan-cta-label="' + qIndex + '"][data-cta-index="' + cIndex + '"]')?.value || "";
        c.url = document.querySelector('[data-carechan-cta-url="' + qIndex + '"][data-cta-index="' + cIndex + '"]')?.value || "#";
        c.visible = document.querySelector('[data-carechan-cta-visible="' + qIndex + '"][data-cta-index="' + cIndex + '"]')?.checked !== false;
      });
    });
  }

  function renderCarechanEditor(){
    if(!carechanDraft) return;
    const d = carechanDraft;

    document.getElementById("carechanEnabled").checked = d.enabled === true;
    document.getElementById("carechanCharacterImage").value = d.character.image || "";
    document.getElementById("carechanCharacterAlt").value = d.character.alt || "";
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

    const preview = document.getElementById("carechanCharacterPreview");
    if(preview){
      const url = d.character.image || "";
      preview.innerHTML = url ? '<img src="' + escapeHtml(url) + '" alt="preview" style="max-width:80px;max-height:80px;">' : "未設定";
    }

    renderQuestionEditor();
    bindCarechanEditorEvents();
    if(window.AdminCollapse && typeof window.AdminCollapse.bindWithin === "function"){
      window.AdminCollapse.bindWithin(document.getElementById("card-carechan-settings"));
    }
  }

  function moveQuestion(index, dir){
    syncQuestionsFromDom();
    const next = index + dir;
    if(next < 0 || next >= carechanDraft.questions.length) return;
    const tmp = carechanDraft.questions[index];
    carechanDraft.questions[index] = carechanDraft.questions[next];
    carechanDraft.questions[next] = tmp;
    normalizeQuestionOrders();
    renderCarechanEditor();
  }

  function moveCta(qIndex, cIndex, dir){
    syncQuestionsFromDom();
    const ctas = carechanDraft.questions[qIndex].ctas;
    const next = cIndex + dir;
    if(next < 0 || next >= ctas.length) return;
    const tmp = ctas[cIndex];
    ctas[cIndex] = ctas[next];
    ctas[next] = tmp;
    normalizeQuestionOrders();
    renderCarechanEditor();
  }

  function bindCarechanEditorEvents(){
    const root = document.getElementById("carechanQuestionsEditor");
    if(!root) return;

    root.onclick = function(event){
      const t = event.target.closest("[data-carechan-q-up]");
      if(t){ moveQuestion(Number(t.getAttribute("data-carechan-q-up")), -1); return; }
      const t2 = event.target.closest("[data-carechan-q-down]");
      if(t2){ moveQuestion(Number(t2.getAttribute("data-carechan-q-down")), 1); return; }
      const t3 = event.target.closest("[data-carechan-q-remove]");
      if(t3){
        if(!confirm("この質問を削除しますか？")) return;
        syncQuestionsFromDom();
        carechanDraft.questions.splice(Number(t3.getAttribute("data-carechan-q-remove")), 1);
        normalizeQuestionOrders();
        renderCarechanEditor();
        return;
      }
      const t4 = event.target.closest("[data-carechan-cta-add]");
      if(t4){
        syncQuestionsFromDom();
        const qi = Number(t4.getAttribute("data-carechan-cta-add"));
        carechanDraft.questions[qi].ctas.push({
          id: "cta-" + Date.now(),
          label: "ボタン",
          url: "#",
          order: carechanDraft.questions[qi].ctas.length + 1,
          visible: true
        });
        normalizeQuestionOrders();
        renderCarechanEditor();
        return;
      }
      const t5 = event.target.closest("[data-carechan-cta-remove]");
      if(t5){
        syncQuestionsFromDom();
        const qi = Number(t5.getAttribute("data-carechan-cta-remove"));
        const ci = Number(t5.getAttribute("data-cta-index"));
        carechanDraft.questions[qi].ctas.splice(ci, 1);
        normalizeQuestionOrders();
        renderCarechanEditor();
        return;
      }
      const t6 = event.target.closest("[data-carechan-cta-up]");
      if(t6){ moveCta(Number(t6.getAttribute("data-carechan-cta-up")), Number(t6.getAttribute("data-cta-index")), -1); return; }
      const t7 = event.target.closest("[data-carechan-cta-down]");
      if(t7){ moveCta(Number(t7.getAttribute("data-carechan-cta-down")), Number(t7.getAttribute("data-cta-index")), 1); }
    };
  }

  async function uploadCarechanCharacter(input){
    try{
      const file = input.files?.[0];
      if(!file) return;
      setCarechanStatus("キャラクター画像をアップロード中...", "warn");
      const url = await uploadCarechanAsset(file);
      document.getElementById("carechanCharacterImage").value = url;
      collectCarechanDraftFromForm();
      renderCarechanEditor();
      setCarechanStatus("画像アップロード成功。carechan.json を保存してください。", "success");
    }catch(error){
      setCarechanStatus("画像アップロード失敗: " + error.message, "error");
    }finally{
      input.value = "";
    }
  }

  function addCarechanQuestion(){
    if(!carechanDraft) return;
    syncQuestionsFromDom();
    carechanDraft.questions.push({
      id: "q-" + Date.now(),
      enabled: true,
      order: carechanDraft.questions.length + 1,
      title: "新しい質問",
      answer: "（回答を入力してください）",
      ctas: []
    });
    normalizeQuestionOrders();
    renderCarechanEditor();
  }

  async function saveCarechanToGitHub(){
    try{
      setCarechanStatus("保存中...", "warn");
      collectCarechanDraftFromForm();
      syncQuestionsFromDom();
      normalizeQuestionOrders();
      await saveFileToGitHub(CARECHAN_PATH, JSON.stringify(carechanDraft, null, 2));
      setCarechanStatus("carechan.json の保存が完了しました。", "success");
    }catch(error){
      setCarechanStatus("保存失敗: " + error.message, "error");
    }
  }

  function bindCarechanAdminUi(){
    document.getElementById("carechanReloadBtn")?.addEventListener("click", function(){
      loadCarechanDraft().catch(function(e){ setCarechanStatus(e.message, "error"); });
    });
    document.getElementById("carechanSaveBtn")?.addEventListener("click", saveCarechanToGitHub);
    document.getElementById("carechanAddQuestionBtn")?.addEventListener("click", addCarechanQuestion);
    document.getElementById("carechanCharacterUpload")?.addEventListener("change", function(e){
      uploadCarechanCharacter(e.target);
    });
  }

  async function initCarechanAdmin(){
    bindCarechanAdminUi();
    try{
      await loadCarechanDraft();
    }catch(error){
      carechanDraft = ensureCarechanDraft({ enabled: false, questions: [] });
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

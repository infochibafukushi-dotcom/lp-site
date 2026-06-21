(function(global){
  let activeOverlay = null;

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function closeHelp(){
    if(activeOverlay){
      activeOverlay.remove();
      activeOverlay = null;
      document.body.style.overflow = "";
    }
  }

  function openHelp(title, description){
    closeHelp();
    if(!String(description || "").trim()){
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "estimate-help-overlay";
    overlay.innerHTML = `
      <div class="estimate-help-sheet" role="dialog" aria-modal="true" aria-labelledby="estimateHelpTitle">
        <div class="estimate-help-head">
          <h3 id="estimateHelpTitle">${escapeHtml(title || "説明")}</h3>
          <button type="button" class="estimate-help-close" aria-label="閉じる">×</button>
        </div>
        <div class="estimate-help-body">${escapeHtml(description).replace(/\n/g, "<br>")}</div>
      </div>
    `;

    overlay.addEventListener("click", function(event){
      if(event.target === overlay){
        closeHelp();
      }
    });
    overlay.querySelector(".estimate-help-close")?.addEventListener("click", closeHelp);

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    activeOverlay = overlay;
  }

  function createHelpButton(title, description){
    const hasDescription = Boolean(String(description || "").trim());
    if(!hasDescription){
      return "";
    }
    return `<button type="button" class="estimate-help-btn" aria-label="${escapeHtml(title)}の説明を見る" data-help-title="${escapeHtml(title)}" data-help-body="${escapeHtml(description)}">?</button>`;
  }

  function bindHelpButtons(root){
    if(!root) return;
    root.querySelectorAll(".estimate-help-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        openHelp(btn.getAttribute("data-help-title"), btn.getAttribute("data-help-body"));
      });
    });
  }

  global.EstimateHelp = {
    openHelp: openHelp,
    closeHelp: closeHelp,
    createHelpButton: createHelpButton,
    bindHelpButtons: bindHelpButtons
  };
})(typeof window !== "undefined" ? window : globalThis);

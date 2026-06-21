(function(global){
  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatDescriptionHtml(description){
    const text = String(description || "").trim();
    if(!text) return "";
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function formatAmountBadge(amount){
    const n = Number(amount) || 0;
    if(n <= 0) return "";
    return `<span class="estimate-choice-amount">＋¥${n.toLocaleString("ja-JP")}</span>`;
  }

  function renderChoiceCard(item, options){
    if(!item) return "";
    options = options || {};
    const name = options.name || "choice";
    const inputType = options.inputType || "radio";
    const checked = options.checked ? " checked" : "";
    const disabled = options.disabled ? " disabled" : "";
    const showAmount = options.showAmount !== false;
    const selectedClass = options.checked ? " is-selected" : "";
    const disabledClass = options.disabled ? " is-disabled" : "";
    const descHtml = formatDescriptionHtml(item.description);
    const amountHtml = showAmount ? formatAmountBadge(item.amount) : "";

    const descBlock = descHtml
      ? `<div class="estimate-choice-desc">${descHtml}</div>`
      : "";

    return `
      <label class="estimate-choice-card${selectedClass}${disabledClass}">
        <input type="${inputType}" name="${escapeHtml(name)}" value="${escapeHtml(item.id)}"${checked}${disabled}>
        <div class="estimate-choice-body">
          <div class="estimate-choice-head">
            <span class="estimate-choice-label">${escapeHtml(item.label)}</span>
            ${amountHtml}
          </div>
          ${descBlock}
        </div>
      </label>
    `;
  }

  global.EstimateHelp = {
    renderChoiceCard: renderChoiceCard,
    formatDescriptionHtml: formatDescriptionHtml
  };
})(typeof window !== "undefined" ? window : globalThis);

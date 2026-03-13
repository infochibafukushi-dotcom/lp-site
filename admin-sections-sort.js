(function(){
  function escapeHtml(text){
    return String(text ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function buildSectionLabel(section, index){
    const title = String(section?.title || '').trim();
    const type = String(section?.type || 'section').trim();
    const anchor = String(section?.sectionId || '').trim();

    return {
      title: title || `タイトル未設定 (${type})`,
      sub: `${type}${anchor ? ' / #' + anchor : ''}`,
      index: index + 1
    };
  }

  window.renderSectionSortList = function(sections){
    const box = document.getElementById('sectionsSortEditor');
    if(!box) return;

    if(!Array.isArray(sections) || sections.length === 0){
      box.innerHTML = '<div class="preview">並び替え対象のセクションがありません。</div>';
      return;
    }

    box.innerHTML = `
      <div class="sort-list">
        ${sections.map((section, index) => {
          const label = buildSectionLabel(section, index);
          return `
            <div class="sort-item">
              <div>
                <div class="sort-title">${label.index}. ${escapeHtml(label.title)}</div>
                <div class="sort-sub">${escapeHtml(label.sub)}</div>
              </div>
              <div class="sort-actions">
                <button type="button" class="secondary small-btn" onclick="moveSectionUp(${index})">↑ 上へ</button>
                <button type="button" class="secondary small-btn" onclick="moveSectionDown(${index})">↓ 下へ</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };
})();

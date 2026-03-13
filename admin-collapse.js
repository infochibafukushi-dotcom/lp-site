(function(){
  function syncCard(card){
    if(!card) return;

    const toggle = card.querySelector('.js-card-toggle');
    const body = card.querySelector('.js-card-body');
    const icon = card.querySelector('.toggle-icon');
    const state = card.querySelector('.toggle-state');
    const isOpen = String(card.dataset.open || 'false') === 'true';

    card.classList.toggle('is-open', isOpen);

    if(body){
      body.style.display = isOpen ? 'block' : 'none';
    }
    if(toggle){
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    if(icon){
      icon.textContent = isOpen ? '▼' : '▶';
    }
    if(state){
      state.textContent = isOpen ? '開いています' : '閉じています';
    }
  }

  function toggleCard(card, forceState){
    if(!card) return;
    const next = typeof forceState === 'boolean'
      ? forceState
      : String(card.dataset.open || 'false') !== 'true';

    card.dataset.open = next ? 'true' : 'false';
    syncCard(card);
  }

  function bindSingleCard(card){
    if(!card || card.dataset.boundCollapse === 'true') return;

    const toggle = card.querySelector('.js-card-toggle');
    if(toggle){
      toggle.addEventListener('click', function(){
        toggleCard(card);
      });
    }

    card.dataset.boundCollapse = 'true';
    syncCard(card);
  }

  function bindWithin(root){
    const scope = root || document;
    const cards = scope.querySelectorAll('.js-collapsible');
    cards.forEach(bindSingleCard);
  }

  window.AdminCollapse = {
    bindWithin: bindWithin,
    toggleCard: toggleCard,
    syncCard: syncCard
  };

  document.addEventListener('DOMContentLoaded', function(){
    bindWithin(document);
  });
})();

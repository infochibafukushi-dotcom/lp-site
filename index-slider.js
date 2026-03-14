(function(){
  const FIXED_DOT_COUNT = 5;
  let sliderTimers = [];
  let sliderTouchState = {};

  function clearSliderTimers(){
    sliderTimers.forEach((timer) => clearInterval(timer.id));
    sliderTimers = [];
    sliderTouchState = {};
  }

  function buildSliderDots(idx, total){
    const dotsWrap = document.getElementById(`slider-dots-${idx}`);
    if(!dotsWrap) return;

    let html = "";
    for(let i = 0; i < FIXED_DOT_COUNT; i++){
      html += `<button class="slider-dot${i === 0 ? " active" : ""}" type="button" onclick="goToSliderDot(${idx}, ${i})"></button>`;
    }
    dotsWrap.innerHTML = html;
    updateSliderDots(idx, 0, total);
  }

  function getFixedDotIndex(current, total){
    if(total <= 1) return 0;
    const ratio = current / (total - 1);
    return Math.max(0, Math.min(FIXED_DOT_COUNT - 1, Math.round(ratio * (FIXED_DOT_COUNT - 1))));
  }

  function getSlideIndexFromDot(dotIndex, total){
    if(total <= 1) return 0;
    const ratio = dotIndex / (FIXED_DOT_COUNT - 1);
    return Math.max(0, Math.min(total - 1, Math.round(ratio * (total - 1))));
  }

  function updateSliderDots(idx, current, total){
    const dotsWrap = document.getElementById(`slider-dots-${idx}`);
    if(!dotsWrap) return;
    const dots = dotsWrap.querySelectorAll(".slider-dot");
    const activeDot = getFixedDotIndex(current, total);
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === activeDot);
    });
  }

  function attachSliderSwipe(shell, idx){
    sliderTouchState[idx] = { startX:0, startY:0 };

    shell.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      sliderTouchState[idx].startX = t.clientX;
      sliderTouchState[idx].startY = t.clientY;
    }, { passive:true });

    shell.addEventListener("touchend", (e) => {
      const state = sliderTouchState[idx];
      if(!state) return;

      const t = e.changedTouches[0];
      const diffX = t.clientX - state.startX;
      const diffY = t.clientY - state.startY;

      if(Math.abs(diffX) < 40) return;
      if(Math.abs(diffY) > Math.abs(diffX)) return;

      if(diffX < 0){
        moveSlider(idx, 1);
        resetSliderTimer(idx);
      }
      if(diffX > 0){
        moveSlider(idx, -1);
        resetSliderTimer(idx);
      }
    }, { passive:true });
  }

  function createSliderTimer(idx){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return null;

    const slides = track.querySelectorAll(".slider-slide");
    if(slides.length <= 1) return null;

    const id = setInterval(() => {
      moveSlider(idx, 1);
    }, 3000);

    return { idx, id };
  }

  function resetSliderTimer(idx){
    const item = sliderTimers.find((v) => v.idx === idx);
    if(item){
      clearInterval(item.id);
      item.id = setInterval(() => {
        moveSlider(idx, 1);
      }, 3000);
    }
  }

  function initSliders(){
    clearSliderTimers();

    document.querySelectorAll(".slider-shell").forEach((shell) => {
      const idx = Number(shell.dataset.sliderIndex);
      const track = document.getElementById(`slider-track-${idx}`);
      if(!track) return;

      const slides = track.querySelectorAll(".slider-slide");
      const total = slides.length;

      if(total === 0) return;

      track.dataset.current = "0";
      updateSliderPosition(idx);
      if(total > 1){
        buildSliderDots(idx, total);
      }
      attachSliderSwipe(shell, idx);

      if(total > 1){
        const timer = createSliderTimer(idx);
        if(timer){
          sliderTimers.push(timer);
        }

        shell.addEventListener("mouseenter", () => {
          const item = sliderTimers.find((v) => v.idx === idx);
          if(item){
            clearInterval(item.id);
          }
        });

        shell.addEventListener("mouseleave", () => {
          resetSliderTimer(idx);
        });
      }
    });
  }

  function updateSliderPosition(idx){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return;

    const slides = track.querySelectorAll(".slider-slide");
    const total = slides.length;
    if(total === 0) return;

    let current = Number(track.dataset.current || "0");
    if(current < 0) current = total - 1;
    if(current >= total) current = 0;

    track.dataset.current = String(current);
    track.style.transform = `translateX(-${current * 100}%)`;
    updateSliderDots(idx, current, total);
  }

  function moveSlider(idx, step){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return;

    const slides = track.querySelectorAll(".slider-slide");
    const total = slides.length;
    if(total === 0) return;

    let current = Number(track.dataset.current || "0");
    current += step;

    if(current >= total) current = 0;
    if(current < 0) current = total - 1;

    track.dataset.current = String(current);
    updateSliderPosition(idx);
  }

  function goToSliderDot(idx, dotIndex){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return;

    const slides = track.querySelectorAll(".slider-slide");
    const total = slides.length;
    if(total === 0) return;

    const target = getSlideIndexFromDot(dotIndex, total);
    track.dataset.current = String(target);
    updateSliderPosition(idx);
    resetSliderTimer(idx);
  }

  window.IndexSlider = {
    initSliders: initSliders,
    moveSlider: moveSlider,
    goToSliderDot: goToSliderDot
  };

  window.goToSliderDot = goToSliderDot;
})();

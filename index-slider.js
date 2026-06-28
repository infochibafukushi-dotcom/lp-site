(function(){
  const FIXED_DOT_COUNT = 5;
  let sliderTimers = [];
  let sliderTouchState = {};

  function clearSliderTimers(){
    sliderTimers.forEach((timer) => clearInterval(timer.id));
    sliderTimers = [];
    sliderTouchState = {};
  }

  function getSliderSlides(track){
    return track.querySelectorAll(".slider-slide:not(.slider-slide-clone)");
  }

  function getSliderRealTotal(track){
    const stored = Number(track.dataset.realTotal);
    if(stored > 0) return stored;
    return getSliderSlides(track).length;
  }

  function ensureCloneSlide(track){
    const existingClone = track.querySelector(".slider-slide-clone");
    if(existingClone){
      existingClone.remove();
    }

    const slides = getSliderSlides(track);
    const realTotal = slides.length;
    track.dataset.realTotal = String(realTotal);

    if(realTotal <= 1) return realTotal;

    const clone = slides[0].cloneNode(true);
    clone.classList.add("slider-slide-clone");
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
    return realTotal;
  }

  function getLogicalIndex(visualIndex, realTotal){
    if(realTotal <= 0) return 0;
    if(visualIndex >= realTotal) return 0;
    if(visualIndex < 0) return realTotal - 1;
    return visualIndex;
  }

  function setSliderTransition(track, enabled){
    track.style.transition = enabled ? "" : "none";
  }

  function applySliderTransform(track, visualIndex){
    track.style.transform = `translateX(-${visualIndex * 100}%)`;
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

  function handleSliderTransitionEnd(idx){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return;

    const realTotal = getSliderRealTotal(track);
    const current = Number(track.dataset.current || "0");

    if(current === realTotal){
      setSliderTransition(track, false);
      track.dataset.current = "0";
      applySliderTransform(track, 0);
      void track.offsetHeight;
      setSliderTransition(track, true);
    }

    track.dataset.transitioning = "false";
  }

  function bindSliderTransitionEnd(track, idx){
    if(track.dataset.loopBound === "true") return;

    track.addEventListener("transitionend", (e) => {
      if(e.target !== track || e.propertyName !== "transform") return;
      handleSliderTransitionEnd(idx);
    });
    track.dataset.loopBound = "true";
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

    const realTotal = getSliderRealTotal(track);
    if(realTotal <= 1) return null;

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

      const realTotal = ensureCloneSlide(track);
      if(realTotal === 0) return;

      track.dataset.current = "0";
      track.dataset.transitioning = "false";
      bindSliderTransitionEnd(track, idx);
      updateSliderPosition(idx);

      if(realTotal > 1){
        buildSliderDots(idx, realTotal);
      }
      attachSliderSwipe(shell, idx);

      if(realTotal > 1){
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

    const realTotal = getSliderRealTotal(track);
    if(realTotal === 0) return;

    let current = Number(track.dataset.current || "0");

    if(current >= realTotal){
      setSliderTransition(track, false);
      current = 0;
      track.dataset.current = "0";
      applySliderTransform(track, 0);
      void track.offsetHeight;
      setSliderTransition(track, true);
      track.dataset.transitioning = "false";
    }else if(current < 0){
      current = realTotal - 1;
      track.dataset.current = String(current);
      applySliderTransform(track, current);
    }else{
      track.dataset.current = String(current);
      applySliderTransform(track, current);
    }

    updateSliderDots(idx, getLogicalIndex(current, realTotal), realTotal);
  }

  function moveSlider(idx, step){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return;
    if(track.dataset.transitioning === "true") return;

    const realTotal = getSliderRealTotal(track);
    if(realTotal <= 1) return;

    let current = Number(track.dataset.current || "0");

    if(step > 0){
      if(current >= realTotal) return;
      current += 1;
      if(current === realTotal){
        track.dataset.transitioning = "true";
      }
    }else{
      current -= 1;
      if(current < 0) current = realTotal - 1;
    }

    track.dataset.current = String(current);
    applySliderTransform(track, current);
    updateSliderDots(idx, getLogicalIndex(current, realTotal), realTotal);
  }

  function goToSliderDot(idx, dotIndex){
    const track = document.getElementById(`slider-track-${idx}`);
    if(!track) return;
    if(track.dataset.transitioning === "true") return;

    const realTotal = getSliderRealTotal(track);
    if(realTotal === 0) return;

    const target = getSlideIndexFromDot(dotIndex, realTotal);
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

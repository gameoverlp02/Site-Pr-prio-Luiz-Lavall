(function () {
  var VIDEO_RE = /\.(mp4|webm|mov|ogg)$/i;
  var observer = null;

  function getObserver() {
    if (observer || !('IntersectionObserver' in window)) return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var src = el.dataset.lazySrc;
        if (src) { el.src = src; delete el.dataset.lazySrc; }
        observer.unobserve(el);
      });
    }, { rootMargin: '300px 0px' });
    return observer;
  }

  function isVideo(url) { return VIDEO_RE.test(url || ''); }
  function posterFor(url) { return '/' + url + '.poster.jpg'; }

  // ---- Adjust helpers ----
  // Media pode ser:
  //   "uploads/foto.jpg"  (string — sem ajustes)
  //   { url: "uploads/foto.jpg", scale: 1.5, x: 10, y: -5 }
  // onde scale >= 1, x/y são offsets em % (centro = 0)
  function getUrl(media) {
    if (!media) return '';
    if (typeof media === 'string') return media;
    return media.url || '';
  }
  function getAdjust(media) {
    if (!media || typeof media !== 'object') return { scale: 1, x: 0, y: 0 };
    return {
      scale: Math.max(1, Number(media.scale) || 1),
      x: Number(media.x) || 0,
      y: Number(media.y) || 0
    };
  }
  function hasAdjust(media) {
    var a = getAdjust(media);
    return a.scale !== 1 || a.x !== 0 || a.y !== 0;
  }
  function adjustToCss(adjust) {
    var a = adjust || { scale: 1, x: 0, y: 0 };
    return 'translate(' + a.x + '%, ' + a.y + '%) scale(' + a.scale + ')';
  }
  // Para uso com background-image / background-size / background-position
  function adjustToBackgroundCss(adjust) {
    var a = adjust || { scale: 1, x: 0, y: 0 };
    // background-size com porcentagem é relativo ao container (background-area)
    // scale=1 → cover; scale=1.5 → 150% mas mantendo o cover ratio
    // Vamos calcular como 'cover' + zoom adicional via size
    var sz = (a.scale * 100) + '%';
    // background-position: 0% = imagem alinhada à esquerda do container; 50% = centro
    // Para mover imagem para direita (positivo X), background-position diminui (-)
    var px = 50 - a.x;
    var py = 50 - a.y;
    return {
      backgroundSize: a.scale === 1 ? 'cover' : ('auto ' + sz),
      backgroundPosition: px + '% ' + py + '%'
    };
  }

  // Cria <video> com poster + lazy src
  function createVideo(url, opts) {
    opts = opts || {};
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    v.preload = 'metadata';
    var p = posterFor(url);
    v.poster = p;
    var probe = new Image();
    probe.onerror = function () { v.removeAttribute('poster'); };
    probe.src = p;
    if (opts.lazy === false) {
      v.src = '/' + url;
    } else {
      v.dataset.lazySrc = '/' + url;
      var obs = getObserver();
      if (obs) obs.observe(v);
      else v.src = '/' + url;
    }
    return v;
  }

  // applyMedia: aplica mídia ao container.
  // Para background-image (mais simples), usa background-size/position.
  // media pode ser string (URL) ou objeto { url, scale, x, y }
  function applyMedia(el, media) {
    if (!el) return;
    var url = getUrl(media);
    if (!url) return;
    var adjust = getAdjust(media);
    if (isVideo(url)) {
      // Poster como background + video sobreposto (com transform pro ajuste)
      el.style.backgroundImage = 'url("' + posterFor(url) + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      var existing = el.querySelector('video');
      if (existing) existing.remove();
      var v = createVideo(url);
      v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit';
      if (hasAdjust(media)) {
        v.style.transform = adjustToCss(adjust);
        v.style.transformOrigin = 'center';
      }
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.appendChild(v);
    } else {
      el.style.backgroundImage = 'url("/' + url + '")';
      if (hasAdjust(media)) {
        var bg = adjustToBackgroundCss(adjust);
        el.style.backgroundSize = bg.backgroundSize;
        el.style.backgroundPosition = bg.backgroundPosition;
      }
    }
  }

  window.MediaHelper = {
    isVideo: isVideo,
    posterFor: posterFor,
    createVideo: createVideo,
    applyMedia: applyMedia,
    getUrl: getUrl,
    getAdjust: getAdjust,
    hasAdjust: hasAdjust,
    adjustToCss: adjustToCss,
    adjustToBackgroundCss: adjustToBackgroundCss
  };
})();

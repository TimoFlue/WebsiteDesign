// Komorebi-Test: Sonnenlicht, das durch Blätter fällt. Zum Vergleichen: Seite mit ?komorebi=aus aufrufen.
(() => {
  // Einstellungen zum Feintuning
  const STRENGTH = 0.24;   // Helligkeit des Lichts (0 = unsichtbar)
  const SPEED = 0.55;      // Tempo der Bewegung
  const SCALE = 1.7;       // größer = kleinere, mehr Lichtflecken
  const MAX_WIDTH = 720;   // interne Auflösung, das Licht ist ohnehin weich
  const FPS = 30;

  if (new URLSearchParams(location.search).get('komorebi') === 'aus') return;

  const canvas = document.createElement('canvas');
  canvas.className = 'komorebi';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return; // Ohne WebGL bleibt die Seite einfach wie sie ist

  const vertexSrc = `
    attribute vec2 pos;
    void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const fragmentSrc = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uScroll;
    uniform float uStrength;
    uniform float uScale;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.3)); }

    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      return 0.55 * noise(p) + 0.3 * noise(p * 2.1 + 3.7) + 0.15 * noise(p * 4.3 + 9.1);
    }

    // Weiche Lichtflecken: jede Lücke im Blätterdach wirft ein rundes Abbild der Sonne,
    // das mit dem Ast schwankt und kurz verschwindet, wenn sich ein Blatt davor schiebt.
    float spots(vec2 p, float t, float seed) {
      vec2 cell = floor(p);
      float sum = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 id = cell + vec2(float(x), float(y));
          vec2 r = hash2(id + seed);
          float present = hash(id * 1.7 + seed);
          if (present < 0.22) continue;
          vec2 sway = 0.22 * vec2(sin(t * (0.5 + r.x) + r.y * 6.28), cos(t * (0.4 + r.y) + r.x * 6.28));
          vec2 d = p - (id + r + sway);
          d.y *= 1.25;
          float radius = 0.26 + 0.34 * hash(id + seed + 5.1);
          float blink = smoothstep(0.0, 0.5, 0.5 + 0.5 * sin(t * (0.3 + 0.7 * present) + r.x * 40.0));
          sum += smoothstep(radius, radius * 0.4, length(d)) * blink * (0.5 + 0.5 * present);
        }
      }
      return sum;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes.y;
      uv.y += uScroll;
      float t = uTime;

      // Windböen bewegen das ganze Blätterdach gemeinsam
      vec2 wind = 0.10 * vec2(sin(t * 0.23) + 0.5 * sin(t * 0.61 + 1.3), cos(t * 0.19) + 0.5 * sin(t * 0.47));
      vec2 p = mat2(0.86, -0.5, 0.5, 0.86) * uv * uScale + wind;

      float light = 0.75 * spots(p, t, 0.0)
                  + 0.55 * spots(p * 1.6 + wind * 0.6 + 4.2, t * 1.2, 11.0)
                  + 0.25 * spots(p * 2.5 - wind * 0.4 + 8.7, t * 1.45, 23.0);

      // Große Zonen aus Licht und Schatten, wie dichteres und lichteres Laub
      float canopy = smoothstep(0.3, 0.68, fbm(uv * 0.9 + vec2(t * 0.012, -t * 0.008)));
      light *= mix(0.22, 1.0, canopy);
      light = clamp(light, 0.0, 1.0);

      vec3 color = mix(vec3(1.0, 0.80, 0.50), vec3(1.0, 0.94, 0.76), light);
      float alpha = light * uStrength;
      gl_FragColor = vec4(color * alpha, alpha);
    }`;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  }

  const vs = compile(gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uScroll = gl.getUniformLocation(program, 'uScroll');
  gl.uniform1f(gl.getUniformLocation(program, 'uStrength'), STRENGTH);
  gl.uniform1f(gl.getUniformLocation(program, 'uScale'), SCALE);

  function resize() {
    const ratio = innerHeight / innerWidth;
    const width = Math.min(innerWidth, MAX_WIDTH);
    canvas.width = width;
    canvas.height = Math.round(width * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  // Startet an zufälliger Stelle im Ablauf, damit das Bild nicht immer gleich beginnt
  const offset = Math.random() * 500;
  function draw(ms) {
    gl.uniform1f(uTime, offset + (ms / 1000) * SPEED);
    gl.uniform1f(uScroll, -(scrollY / innerHeight) * 0.12); // Licht wandert beim Scrollen leicht mit
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = 0;
  function loop(ms) {
    requestAnimationFrame(loop);
    if (document.hidden || ms - last < 1000 / FPS) return;
    last = ms;
    draw(ms);
  }

  resize();
  addEventListener('resize', () => { resize(); if (still) draw(0); });
  document.body.prepend(canvas);
  if (still) {
    draw(0); // Bei „Bewegung reduzieren“ nur ein ruhiges Standbild
    addEventListener('scroll', () => draw(0), { passive: true });
  } else {
    requestAnimationFrame(loop);
  }
})();

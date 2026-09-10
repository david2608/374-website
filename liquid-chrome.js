// <liquid-chrome> — WebGL flowing-chrome shader surface. Fills its container.
// Attributes: base-color="0.039,0.039,0.039", speed="2", amplitude="0.1", interactive
(function () {
  if (customElements.get('liquid-chrome')) return;
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = [
    'precision highp float;',
    'uniform float uTime;uniform vec3 uRes;uniform vec3 uBase;uniform float uAmp;uniform vec2 uMouse;',
    'void main(){',
    ' vec2 uv=(2.*gl_FragCoord.xy-uRes.xy)/min(uRes.x,uRes.y);',
    ' for(float i=1.;i<10.;i++){',
    '  uv.x+=uAmp/i*cos(i*2.5*uv.y+uTime);',
    '  uv.y+=uAmp/i*cos(i*1.5*uv.x+uTime);',
    ' }',
    ' vec2 d=uv-uMouse;float g=exp(-dot(d,d)*8.)*0.35;',
    ' vec3 c=uBase/abs(sin(uTime-uv.y-uv.x));',
    ' gl_FragColor=vec4(c+g,1.);',
    '}'
  ].join('\n');

  class LiquidChrome extends HTMLElement {
    connectedCallback() {
      if (this._i) return; this._i = 1;
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML = '<style>:host{display:block;position:relative}canvas{display:block;width:100%;height:100%}</style><canvas></canvas>';
      const cv = sh.querySelector('canvas');
      const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!gl) { this.style.background = 'linear-gradient(120deg,#0a0a0a,#8e8e94,#0a0a0a)'; return; }
      const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uT = gl.getUniformLocation(pr, 'uTime'), uR = gl.getUniformLocation(pr, 'uRes'),
        uB = gl.getUniformLocation(pr, 'uBase'), uA = gl.getUniformLocation(pr, 'uAmp'),
        uM = gl.getUniformLocation(pr, 'uMouse');

      const base = (this.getAttribute('base-color') || '0.039,0.039,0.039').split(',').map(Number);
      const speed = parseFloat(this.getAttribute('speed') || '2');
      const amp = parseFloat(this.getAttribute('amplitude') || '0.1');
      gl.uniform3f(uB, base[0] || 0, base[1] || 0, base[2] || 0);
      gl.uniform1f(uA, amp);
      this._m = [0, 0];
      if (this.hasAttribute('interactive')) {
        this.addEventListener('pointermove', e => {
          const r = this.getBoundingClientRect();
          this._m = [((e.clientX - r.left) / r.width) * 2 - 1, (1 - (e.clientY - r.top) / r.height) * 2 - 1];
        });
        this.addEventListener('pointerleave', () => { this._m = [0, 0]; });
      }

      const size = () => {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(this.clientWidth * dpr)), h = Math.max(1, Math.round(this.clientHeight * dpr));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); gl.uniform3f(uR, w, h, 1); }
      };
      const ro = new ResizeObserver(size); ro.observe(this); this._ro = ro; size();

      const reduce = matchMedia('(prefers-reduced-motion: reduce)');
      let t0 = performance.now();
      const frame = now => {
        if (this._dead) return;
        this._rf = requestAnimationFrame(frame);
        const r = this.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
        const t = reduce.matches ? 0.6 : ((now - t0) / 1000) * speed * 0.4;
        gl.uniform1f(uT, t);
        gl.uniform2f(uM, this._m[0], this._m[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      this._rf = requestAnimationFrame(frame);
    }
    disconnectedCallback() { this._dead = 1; cancelAnimationFrame(this._rf); this._ro && this._ro.disconnect(); }
  }
  customElements.define('liquid-chrome', LiquidChrome);
})();

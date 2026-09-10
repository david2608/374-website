// <jelly-fish> — procedural three.js jellyfish (shaded bell + shader-driven strands).
// Transparent canvas, warm NOVRA-tinted palette. Attribute: loop="20" (seconds per turn).
import * as THREE from "https://unpkg.com/three@0.184.0/build/three.module.js";

const BELL_VERT = `
varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
void main(){
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const BELL_FRAG = `
precision highp float;
uniform float uTime;
varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float fres = pow(1.0 - max(dot(N,V),0.0), 2.4);
  float h = clamp((vPos.y + 0.40)/1.40, 0.0, 1.0);
  float ang = atan(vPos.z, vPos.x);
  vec3 top  = vec3(0.86, 0.27, 0.09);
  vec3 mid  = vec3(0.98, 0.48, 0.24);
  vec3 edge = vec3(0.99, 0.77, 0.63);
  vec3 col = mix(edge, mid, smoothstep(0.0,0.5,h));
  col = mix(col, top, smoothstep(0.45,1.0,h));
  float ribs = abs(fract(ang/(2.0*3.14159265)*18.0) - 0.5) * 2.0;
  float ribLine = smoothstep(0.80, 0.99, ribs);
  float ribMask = smoothstep(0.98,0.55,h) * smoothstep(-0.02,0.22,h);
  col *= 1.0 - ribLine * 0.55 * ribMask;
  float backw = gl_FrontFacing ? 1.0 : 0.0;
  float band = smoothstep(0.34, 0.02, h);
  float spots = noise(vec2(ang*7.0, h*12.0));
  float wart = smoothstep(0.58, 0.86, spots) * band;
  col = mix(col, vec3(0.44,0.13,0.05), wart*0.8*backw);
  col += fres * vec3(0.26, 0.17, 0.40);
  col += (1.0 - fres) * vec3(0.20,0.07,0.03) * (0.5 + 0.5*h);
  float alpha = 0.50 + fres*0.45 + ribLine*ribMask*0.22 + wart*0.35*backw;
  alpha *= mix(0.30, 1.0, backw);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.96));
}`;

const STRAND_VERT = `
uniform float uTime; uniform float uLen; uniform float uPhase; uniform float uAmp; uniform float uFreq;
varying float vK; varying vec3 vNormal; varying vec3 vView; varying float vWorldY;
void main(){
  vec3 p = position;
  float k = clamp(-p.y / uLen, 0.0, 1.0);
  float amp = k*k*uAmp;
  p.x += sin(uTime*1.5 + k*uFreq + uPhase) * amp;
  p.z += cos(uTime*1.2 + k*uFreq*0.9 + uPhase*1.3) * amp;
  vK = k;
  vWorldY = (modelMatrix * vec4(p,1.0)).y;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const STRAND_FRAG = `
precision highp float;
uniform vec3 uTop; uniform vec3 uTip; uniform float uOpacity; uniform vec2 uFade; uniform vec2 uFadeTop;
varying float vK; varying vec3 vNormal; varying vec3 vView; varying float vWorldY;
void main(){
  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)),0.0), 1.6);
  float vis = smoothstep(uFade.x, uFade.y, vWorldY) * smoothstep(uFadeTop.y, uFadeTop.x, vWorldY);
  vec3 col = mix(uTop, uTip, vK) + fres*0.25;
  float alpha = ((1.0 - vK*0.92) * uOpacity + fres*0.12) * vis;
  gl_FragColor = vec4(col, clamp(alpha,0.0,1.0));
}`;

function strandGeometry(length, thickness, curl) {
  const seg = 40, radial = 6, spine = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    spine.push(new THREE.Vector3(Math.sin(t * 3) * curl * t, -t * length, Math.cos(t * 2) * curl * t));
  }
  const curve = new THREE.CatmullRomCurve3(spine);
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t);
    const r = thickness * (1 - Math.pow(t, 0.75));
    const Nf = frames.normals[i], Bf = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(
        p.x + (c * Nf.x + s * Bf.x) * r,
        p.y + (c * Nf.y + s * Bf.y) * r,
        p.z + (c * Nf.z + s * Bf.z) * r
      );
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function strand(time, o) {
  const geo = strandGeometry(o.length, o.thickness, o.curl);
  const mat = new THREE.ShaderMaterial({
    vertexShader: STRAND_VERT,
    fragmentShader: STRAND_FRAG,
    uniforms: {
      uTime: time,
      uLen: { value: o.length },
      uPhase: { value: o.phase },
      uAmp: { value: o.amp },
      uFreq: { value: o.freq },
      uTop: { value: new THREE.Color(o.top) },
      uTip: { value: new THREE.Color(o.tip) },
      uOpacity: { value: o.opacity },
      uFade: { value: new THREE.Vector2(-1.2, -0.15) },
      uFadeTop: { value: new THREE.Vector2(-0.62, -0.22) },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(Math.cos(o.angle) * o.radius, o.yOffset, Math.sin(o.angle) * o.radius);
  return m;
}

class JellyFish extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = 1;
    const loop = parseFloat(this.getAttribute('loop')) || 20;
    if (!this.style.position) this.style.position = 'relative';
    this.style.display = 'block';
    if (!this.style.width) this.style.width = '100%';
    if (!this.style.height) this.style.height = '100%';
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const cv = renderer.domElement;
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    this.appendChild(cv);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    cam.position.set(0, 0.4, 6);
    const grp = new THREE.Group();
    scene.add(grp);
    const time = { value: 0 };

    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 128, 0, Math.PI * 2, 0, 1.98),
      new THREE.ShaderMaterial({
        vertexShader: BELL_VERT, fragmentShader: BELL_FRAG,
        uniforms: { uTime: time }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    bell.scale.set(1, 0.84, 1);
    grp.add(bell);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: '#ff8a4c', transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    glow.position.y = 0.18;
    grp.add(glow);

    for (let i = 0; i < 28; i++) grp.add(strand(time, {
      angle: (i / 28) * Math.PI * 2, radius: 0.82, yOffset: -0.25, length: 4.2,
      thickness: 0.016, curl: 0.05, amp: 0.5, freq: 7, phase: i * 0.5,
      top: '#ffd2b4', tip: '#ffeade', opacity: 0.55,
    }));
    for (let i = 0; i < 8; i++) grp.add(strand(time, {
      angle: (i / 8) * Math.PI * 2, radius: 0.22, yOffset: -0.1, length: 2,
      thickness: 0.07, curl: 0.14, amp: 0.32, freq: 10, phase: i + 0.4,
      top: '#ffdcc6', tip: '#f0955c', opacity: 0.72,
    }));

    const size = () => {
      const r = this.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    size();
    this._ro = new ResizeObserver(size);
    this._ro.observe(this);

    let vis = true;
    this._io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 });
    this._io.observe(this);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const clock = new THREE.Clock();
    let t = 0, still = 0;
    const frame = () => {
      this._rf = requestAnimationFrame(frame);
      const d = clock.getDelta();
      if (!vis) return;
      if (reduce.matches) {
        if (still) return;
        still = 1; t = 0;
      } else {
        still = 0;
        t += Math.min(0.05, d);
      }
      time.value = t;
      grp.rotation.y = -(t / loop) * Math.PI * 2;
      grp.position.y = Math.sin(t * 0.6) * 0.08;
      const k = Math.sin(t * 1.7);
      grp.scale.set(1 + k * 0.05, 1 - k * 0.06, 1 + k * 0.05);
      renderer.render(scene, cam);
    };
    frame();
    this._stop = () => { cancelAnimationFrame(this._rf); renderer.dispose(); };
  }
  disconnectedCallback() {
    this._stop && this._stop();
    this._ro && this._ro.disconnect();
    this._io && this._io.disconnect();
  }
}
if (!customElements.get('jelly-fish')) customElements.define('jelly-fish', JellyFish);

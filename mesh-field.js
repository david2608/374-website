// <mesh-field> — gravitational wireframe mesh that warps toward the cursor.
// Attributes: color (line color), warp (px-ish strength), density (segments)
(() => {
  if (customElements.get('mesh-field')) return;

  class MeshField extends HTMLElement {
    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      this.style.display = 'block';
      this.style.position = this.style.position || 'absolute';
      this.style.inset = this.style.inset || '0';
      this._boot();
    }

    disconnectedCallback() { this._dispose && this._dispose(); }

    async _boot() {
      let THREE;
      try { THREE = await import('https://esm.sh/three@0.160.0'); }
      catch (e) { console.warn('mesh-field: three.js failed to load', e); return; }
      if (!this.isConnected) return;

      const color = this.getAttribute('color') || '#12305c';
      const warpAmt = parseFloat(this.getAttribute('warp') || '3.2');
      const seg = parseInt(this.getAttribute('density') || '52', 10);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearAlpha(0);
      const cv = renderer.domElement;
      cv.style.cssText = 'display:block;width:100%;height:100%;opacity:0;transition:opacity 1.1s cubic-bezier(.23,1,.32,1)';
      this.appendChild(cv);

      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uExtent: { value: new THREE.Vector2(10, 7.6) },
        uWarp: { value: warpAmt },
        uColor: { value: new THREE.Color(color) }
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          uniform float uTime; uniform vec2 uMouse; uniform vec2 uExtent; uniform float uWarp;
          varying float vI;
          void main() {
            vec3 pos = position;
            float d = distance(pos.xy, uMouse * uExtent);
            float warp = 1.0 - smoothstep(0.0, 6.0, d);
            warp = pow(warp, 1.4);
            pos.z += warp * uWarp;
            pos.z += sin(pos.x * 0.42 + uTime * 0.45) * 0.28;
            pos.z += cos(pos.y * 0.36 - uTime * 0.33) * 0.22;
            vI = warp;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor; varying float vI;
          void main() {
            float a = 0.055 + vI * 0.72;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        wireframe: true,
        transparent: true,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(44, 44, seg, seg), material);
      mesh.rotation.x = -0.22;
      scene.add(mesh);

      const target = new THREE.Vector2(0, 0);
      const clock = new THREE.Clock();

      const size = () => {
        const r = this.getBoundingClientRect();
        const w = Math.max(1, r.width), h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
        uniforms.uExtent.value.set(halfH * camera.aspect, halfH / Math.cos(0.22));
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(this);

      const onMove = e => {
        const r = this.getBoundingClientRect();
        if (!r.height) return;
        target.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      };
      window.addEventListener('mousemove', onMove, { passive: true });

      let raf = 0, visible = true;
      const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
      io.observe(this);

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        uniforms.uTime.value = clock.getElapsedTime();
        uniforms.uMouse.value.lerp(target, 0.055);
        renderer.render(scene, camera);
      };
      tick();
      requestAnimationFrame(() => { cv.style.opacity = '1'; });

      this._dispose = () => {
        cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        window.removeEventListener('mousemove', onMove);
        mesh.geometry.dispose(); material.dispose(); renderer.dispose();
        cv.remove();
        this._booted = false;
      };
    }
  }

  customElements.define('mesh-field', MeshField);
})();

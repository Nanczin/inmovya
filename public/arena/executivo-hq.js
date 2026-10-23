// Executivo em estilo HISTÓRIA EM QUADRINHOS de super-herói (Three.js):
// sombras duras (cel shading), contorno de nanquim, porte heroico, fundo de explosão com retícula e onomatopeias.
// Terno, cabelo social repartido, falando ao telefone e ajeitando a gravata.
// Uso: const desmontar = await montar(divContainer, { modo: "heroi" })
// Eventos: window "inmovya-avatar-xp" (POW!) e "inmovya-avatar-venda" (FECHOU!).
import * as THREE from "/vendor/three.module.min.js";

function gradiente2() {
  const t = new THREE.DataTexture(new Uint8Array([95, 255]), 2, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// fundo de quadrinho: explosão radial + retícula de pontos + silhueta da cidade
function texFundo() {
  const W = 1024, H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const cx = W * 0.5, cy = H * 0.42;
  g.fillStyle = "#ffcf2e";
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * Math.PI * 2, a1 = ((i + 0.5) / 28) * Math.PI * 2;
    g.fillStyle = i % 2 ? "#ff9a1f" : "#ffb41f";
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a0) * 1600, cy + Math.sin(a0) * 1600);
    g.lineTo(cx + Math.cos(a1) * 1600, cy + Math.sin(a1) * 1600);
    g.closePath();
    g.fill();
  }
  // retícula (pontos que crescem para as bordas)
  for (let y = 0; y < H; y += 14) {
    for (let x = (y / 14) % 2 ? 7 : 0; x < W; x += 14) {
      const d = Math.hypot(x - cx, y - cy) / 720;
      const r = Math.min(6, d * 5.5);
      if (r < 0.6) continue;
      g.fillStyle = "rgba(200,40,20,.55)";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // cidade em silhueta com janelas
  let x = 0;
  while (x < W) {
    const w = 50 + Math.random() * 90, h = 160 + Math.random() * 330;
    g.fillStyle = "#1d2a5c";
    g.fillRect(x, H - h, w, h);
    g.strokeStyle = "#0a0f24";
    g.lineWidth = 6;
    g.strokeRect(x, H - h, w, h);
    for (let yy = H - h + 14; yy < H - 10; yy += 22)
      for (let xx = x + 10; xx < x + w - 14; xx += 18) if (Math.random() < 0.5) {
        g.fillStyle = "#ffe27a";
        g.fillRect(xx, yy, 8, 11);
      }
    x += w + 6;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// onomatopeia de quadrinho
function texTexto(texto, cor = "#ffe600", fundo = null) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.translate(256, 128);
  if (fundo) {
    g.fillStyle = fundo;
    g.strokeStyle = "#111";
    g.lineWidth = 10;
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 80 : 125;
      const a = (i / 24) * Math.PI * 2;
      g.lineTo(Math.cos(a) * r * 1.9, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.rotate(-0.12);
  g.font = "900 96px Impact, 'Arial Black', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 22;
  g.strokeStyle = "#111";
  g.strokeText(texto, 6, 8);
  g.fillStyle = "#c81e1e";
  g.fillText(texto, 6, 8);
  g.strokeText(texto, 0, 0);
  g.fillStyle = cor;
  g.fillText(texto, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function montar(container, opcoes = {}) {
  const { modo = "heroi" } = opcoes;
  const heroi = modo === "heroi";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(heroi ? 32 : 30, 1, 0.1, 100);
  const alvo = heroi ? new THREE.Vector3(0, 1.45, 0) : new THREE.Vector3(0, 1.0, 0);
  const camBase = heroi ? new THREE.Vector3(0.35, 1.1, 3.1) : new THREE.Vector3(0.3, 1.1, 4.8);
  camera.position.copy(camBase);
  camera.lookAt(alvo);

  // fundo preso à câmera (quadro de HQ)
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texFundo(), depthWrite: false }));
  fundo.position.set(0, 0, -20);
  fundo.renderOrder = -1;
  camera.add(fundo);
  cena.add(camera);

  cena.add(new THREE.AmbientLight(0xffffff, 0.55));
  const luz = new THREE.DirectionalLight(0xfff4e0, 2.6);
  luz.position.set(2.2, 3, 3);
  cena.add(luz);
  const contra = new THREE.DirectionalLight(0x7fb0ff, 1.6);
  contra.position.set(-3, 2, -2);
  cena.add(contra);

  const grad = gradiente2();
  const cel = (cor, extra = {}) => new THREE.MeshToonMaterial({ color: cor, gradientMap: grad, ...extra });
  const tinta = new THREE.MeshBasicMaterial({ color: 0x0b0b12, side: THREE.BackSide });
  const pretoTinta = new THREE.MeshBasicMaterial({ color: 0x0b0b12 });

  const grupo = new THREE.Group();
  cena.add(grupo);
  const homem = new THREE.Group();
  grupo.add(homem);

  // malha + contorno de nanquim (casco invertido)
  const add = (geo, mat, x = 0, y = 0, z = 0, pai = homem, esp = 0.011) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    pai.add(m);
    if (esp) {
      geo.computeBoundingSphere();
      const o = new THREE.Mesh(geo, tinta);
      o.scale.setScalar(1 + esp / Math.max(0.02, geo.boundingSphere.radius));
      m.add(o);
    }
    return m;
  };
  const capsula = (a, b, r, mat, pai = homem, esp = 0.011) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const len = Math.max(0.001, d.length());
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat);
    m.position.copy(va).add(d.clone().multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    pai.add(m);
    if (esp) m.add(new THREE.Mesh(new THREE.CapsuleGeometry(r + esp, len, 8, 20), tinta));
    return m;
  };

  const terno = cel(0x26314f), ternoClaro = cel(0x34436b), camisa = cel(0xf4f6fb), gravata = cel(0xc4161c), pele = cel(0xe9a77e),
    peleSombra = cel(0xc98462), cabelo = cel(0x161a28), sapato = cel(0x111116), ouro = cel(0xf2b630), celMat = cel(0x15151c);

  // ---- pernas e sapatos ----
  for (const s of [-1, 1]) {
    capsula([0.1 * s, 0.95, 0], [0.11 * s, 0.52, 0.01], 0.07, terno);
    capsula([0.11 * s, 0.52, 0.01], [0.115 * s, 0.12, -0.01], 0.056, terno);
    const sp = add(new THREE.CapsuleGeometry(0.048, 0.17, 6, 14), sapato, 0.115 * s, 0.05, 0.05);
    sp.rotation.x = Math.PI / 2;
    sp.scale.set(1.05, 1, 0.72);
  }

  // ---- tronco em V (porte de herói) ----
  const tronco = new THREE.Group();
  homem.add(tronco);
  const perfil = [
    [0.001, 0.86], [0.17, 0.86], [0.165, 0.96], [0.155, 1.05], [0.17, 1.15], [0.205, 1.26], [0.235, 1.36], [0.24, 1.42], [0.22, 1.47], [0.15, 1.52], [0.06, 1.55], [0.001, 1.555],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const paleto = add(new THREE.LatheGeometry(perfil, 48), terno, 0, 0, 0, tronco, 0.012);
  paleto.scale.z = 0.6;
  capsula([-0.2, 1.465, 0], [0.2, 1.465, 0], 0.068, terno, tronco).scale.z = 0.9;
  // camisa, gravata e lapelas (frente)
  const frente = 0.146;
  const vShape = new THREE.Shape();
  vShape.moveTo(-0.085, 0.0);
  vShape.lineTo(0.085, 0.0);
  vShape.lineTo(0, -0.3);
  vShape.lineTo(-0.085, 0.0);
  const camisaV = add(new THREE.ShapeGeometry(vShape), camisa, 0, 1.52, frente, tronco, 0);
  camisaV.rotation.x = -0.12;
  const gShape = new THREE.Shape();
  gShape.moveTo(-0.018, 0);
  gShape.lineTo(0.018, 0);
  gShape.lineTo(0.032, -0.2);
  gShape.lineTo(0, -0.24);
  gShape.lineTo(-0.032, -0.2);
  gShape.lineTo(-0.018, 0);
  const grav = add(new THREE.ShapeGeometry(gShape), gravata, 0, 1.47, frente + 0.006, tronco, 0);
  grav.rotation.x = -0.1;
  add(new THREE.SphereGeometry(0.022, 12, 10), gravata, 0, 1.48, frente + 0.004, tronco, 0.005).scale.set(1.2, 0.9, 0.6);
  for (const s of [-1, 1]) {
    const lap = add(new THREE.BoxGeometry(0.045, 0.3, 0.012), ternoClaro, 0.072 * s, 1.39, frente + 0.004, tronco, 0.006);
    lap.rotation.z = 0.27 * s;
    lap.rotation.y = 0.3 * s;
  }
  add(new THREE.SphereGeometry(0.011, 8, 6), ouro, 0.0, 1.12, 0.14, tronco, 0.004);
  // pescoço forte
  add(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 16), pele, 0, 1.6, 0, tronco, 0.008);
  const gola = add(new THREE.TorusGeometry(0.062, 0.014, 8, 20), camisa, 0, 1.555, 0.004, tronco, 0.005);
  gola.rotation.x = Math.PI / 2;

  // ---- cabeça de herói de HQ: queixo quadrado, sobrancelha marcada, cabelo social repartido ----
  const cabeca = new THREE.Group();
  cabeca.position.set(0, 1.725, 0);
  tronco.add(cabeca);
  const cranio = add(new THREE.SphereGeometry(0.105, 32, 24), pele, 0, 0.02, -0.008, cabeca, 0.009);
  cranio.scale.set(0.86, 1.02, 1.0);
  const mand = add(new THREE.BoxGeometry(0.15, 0.1, 0.13), pele, 0, -0.058, 0.012, cabeca, 0.008);
  mand.scale.set(1, 1, 1);
  const queixo = add(new THREE.BoxGeometry(0.075, 0.035, 0.05), pele, 0, -0.103, 0.06, cabeca, 0.006);
  add(new THREE.BoxGeometry(0.004, 0.022, 0.01), pretoTinta, 0, -0.1, 0.086, cabeca, 0); // furinho no queixo
  // maçãs do rosto (sombra dura)
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.012, 0.05, 0.03), peleSombra, 0.066 * s, -0.03, 0.06, cabeca, 0).rotation.y = 0.5 * s;
  // testa/sobrancelha marcada
  const testa = add(new THREE.BoxGeometry(0.15, 0.03, 0.04), pele, 0, 0.035, 0.07, cabeca, 0.006);
  testa.rotation.x = 0.2;
  // olhos de HQ: amêndoa branca, pupila e sobrancelha grossa (olhar determinado)
  const olhos = [];
  for (const s of [-1, 1]) {
    const o = add(new THREE.SphereGeometry(1, 16, 10), camisa, 0.036 * s, 0.012, 0.087, cabeca, 0);
    o.scale.set(0.02, 0.009, 0.006);
    const pu = add(new THREE.SphereGeometry(1, 12, 8), pretoTinta, 0.034 * s, 0.012, 0.092, cabeca, 0);
    pu.scale.set(0.007, 0.008, 0.003);
    const sob = add(new THREE.BoxGeometry(0.05, 0.011, 0.01), pretoTinta, 0.038 * s, 0.032, 0.093, cabeca, 0);
    sob.rotation.z = -0.22 * s;
    const risco = add(new THREE.BoxGeometry(0.03, 0.003, 0.004), pretoTinta, 0.036 * s, -0.002, 0.092, cabeca, 0); // linha embaixo do olho
    risco.rotation.z = 0.15 * s;
    olhos.push(o, pu);
  }
  // nariz reto
  add(new THREE.BoxGeometry(0.022, 0.055, 0.03), pele, 0, -0.015, 0.093, cabeca, 0.005).rotation.x = -0.25;
  add(new THREE.BoxGeometry(0.006, 0.04, 0.004), peleSombra, 0.012, -0.018, 0.106, cabeca, 0);
  // boca: meio sorriso confiante
  const boca = add(new THREE.BoxGeometry(0.045, 0.005, 0.005), pretoTinta, 0.004, -0.068, 0.081, cabeca, 0);
  boca.rotation.z = 0.12;
  // orelhas
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.022, 10, 8), pele, 0.09 * s, -0.005, -0.005, cabeca, 0.005).scale.set(0.45, 1.2, 0.85);
  // cabelo social: volume em cima, laterais curtas, risca do lado e topete penteado
  const cab = add(new THREE.SphereGeometry(0.11, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.45), cabelo, 0, 0.035, -0.02, cabeca, 0.009);
  cab.scale.set(0.92, 1.05, 1.02);
  cab.rotation.x = -0.45; // testa à mostra
  // topete penteado de lado (cabelo social)
  const onda = add(new THREE.SphereGeometry(0.075, 24, 16), cabelo, 0.018, 0.112, 0.03, cabeca, 0.008);
  onda.scale.set(1.3, 0.6, 1.15);
  onda.rotation.z = -0.22;
  const onda2 = add(new THREE.SphereGeometry(0.05, 20, 14), cabelo, 0.055, 0.09, 0.07, cabeca, 0.007);
  onda2.scale.set(1.2, 0.6, 0.9);
  onda2.rotation.z = -0.5;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.015, 0.06, 0.07), cabelo, 0.094 * s, 0.035, -0.01, cabeca, 0.005); // costeletas
  add(new THREE.BoxGeometry(0.005, 0.004, 0.1), pretoTinta, -0.04, 0.14, 0.01, cabeca, 0).rotation.z = 0.35; // risca
  // brilho azul de HQ no cabelo
  const reflexo = add(new THREE.BoxGeometry(0.07, 0.006, 0.03), new THREE.MeshBasicMaterial({ color: 0x5d7bd6 }), 0.03, 0.148, 0.06, cabeca, 0);
  reflexo.rotation.z = -0.3;

  // ---- braço com o celular no ouvido ----
  const bracoT = new THREE.Group();
  tronco.add(bracoT);
  capsula([-0.22, 1.45, 0], [-0.31, 1.25, 0.18], 0.054, terno, bracoT);
  capsula([-0.31, 1.25, 0.18], [-0.15, 1.6, 0.06], 0.047, terno, bracoT);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 14), camisa, -0.155, 1.6, 0.06, bracoT, 0.004).lookAt(new THREE.Vector3(-0.12, 1.7, 0.04));
  const mao = add(new THREE.SphereGeometry(0.046, 16, 12), pele, -0.125, 1.64, 0.05, bracoT, 0.007);
  mao.scale.set(0.8, 1.15, 0.85);
  const tel = new THREE.Group();
  tel.position.set(-0.105, 1.7, 0.045);
  tel.rotation.set(0.15, -0.35, 0.22);
  bracoT.add(tel);
  add(new THREE.BoxGeometry(0.012, 0.15, 0.072), celMat, 0, 0, 0, tel, 0.005);

  // ---- outro braço: ajeitando a gravata ----
  const bracoG = new THREE.Group();
  tronco.add(bracoG);
  capsula([0.22, 1.45, 0], [0.31, 1.2, 0.1], 0.054, terno, bracoG);
  capsula([0.31, 1.2, 0.1], [0.07, 1.44, 0.17], 0.047, terno, bracoG);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 14), camisa, 0.085, 1.43, 0.165, bracoG, 0.004).lookAt(new THREE.Vector3(0, 1.48, 0.18));
  const maoG = add(new THREE.SphereGeometry(0.045, 16, 12), pele, 0.045, 1.47, 0.17, bracoG, 0.007);
  maoG.scale.set(1.1, 0.85, 0.75);
  const rel = add(new THREE.TorusGeometry(0.05, 0.01, 8, 20), ouro, 0.1, 1.415, 0.16, bracoG, 0.004);
  rel.lookAt(new THREE.Vector3(0.3, 1.2, 0.1));

  // ---- onomatopeias ----
  const sfx = (txt, cor, fundoCor, w, h) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texTexto(txt, cor, fundoCor), transparent: true, depthTest: false }));
    s.scale.set(w, h, 1);
    s.renderOrder = 10;
    s.visible = false;
    cena.add(s);
    return s;
  };
  const trim = sfx("TRIIIM!", "#ffe600", null, 0.7, 0.35);
  trim.position.set(-0.38, 1.92, 0.2);
  const pow = sfx("POW!", "#ffe600", "#ffffff", 0.75, 0.38);
  pow.position.set(0.38, 1.82, 0.3);
  const fechou = sfx("FECHOU!", "#ffe600", "#2a7fff", 1.3, 0.65);
  fechou.position.set(0.05, 1.98, 0.4);
  // linhas de ação saindo do celular
  const linhas = new THREE.Group();
  linhas.position.set(-0.12, 1.7, 0.05);
  homem.add(linhas);
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.008), pretoTinta);
    const a = Math.PI * (0.62 + i * 0.13);
    l.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0);
    l.rotation.z = a - Math.PI / 2;
    linhas.add(l);
  }

  // ---- interação ----
  let rotY = 0.25, velRot = 0, arrastando = false, ultX = 0, ultInteracao = -1e9, mouseX = 0, mouseY = 0;
  const el = renderer.domElement;
  const down = (e) => ((arrastando = true), (ultX = e.clientX), (el.style.cursor = "grabbing"), el.setPointerCapture?.(e.pointerId));
  const move = (e) => {
    const r = el.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!arrastando) return;
    velRot = (e.clientX - ultX) * 0.012;
    ultX = e.clientX;
    rotY += velRot;
    ultInteracao = performance.now();
  };
  const up = () => ((arrastando = false), (el.style.cursor = "grab"), (ultInteracao = performance.now()));
  const sair = () => ((mouseX = 0), (mouseY = 0));
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", sair);

  const ajustar = () => {
    const w = container.clientWidth || 200, h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // fundo cobre todo o quadro
    const altura = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 20;
    const lado = Math.max(altura, altura * camera.aspect) * 1.05;
    fundo.scale.set(lado, lado, 1);
  };
  ajustar();
  const ro = new ResizeObserver(ajustar);
  ro.observe(container);
  let visivel = true;
  const io = new IntersectionObserver((es) => (visivel = es[0]?.isIntersecting ?? true));
  io.observe(container);

  const relogio = new THREE.Clock();
  let tXp = -10, tVenda = -10, tTrim = -10;
  const xp = () => (tXp = relogio.getElapsedTime());
  const venda = () => (tVenda = relogio.getElapsedTime());
  window.addEventListener("inmovya-avatar-xp", xp);
  window.addEventListener("inmovya-avatar-venda", venda);
  const estoura = (s, g, dur, base) => {
    const on = g >= 0 && g < dur;
    s.visible = on;
    if (!on) return;
    const k = g < 0.15 ? g / 0.15 : 1;
    const sc = (0.3 + 0.7 * k) * (1 + Math.sin(g * 18) * 0.04 * (1 - g / dur));
    s.scale.set(base[0] * sc, base[1] * sc, 1);
    s.material.opacity = g > dur - 0.25 ? (dur - g) / 0.25 : 1;
  };

  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  const quadro = () => {
    raf = requestAnimationFrame(quadro);
    if (!visivel || document.hidden) return;
    const t = window.__t ?? relogio.getElapsedTime();
    if (!arrastando) {
      velRot *= 0.93;
      rotY += velRot;
      if (!reduzir && performance.now() - ultInteracao > 2500) rotY += (0.25 + Math.sin(t * 0.3) * 0.3 - rotY) * 0.02;
    }
    grupo.rotation.y = rotY;
    const resp = Math.sin(t * 1.4);
    tronco.scale.set(1 + resp * 0.006, 1 + resp * 0.003, 1 + resp * 0.01);
    cabeca.rotation.y = -0.15 + Math.sin(t * 0.45) * 0.12 + mouseX * 0.2;
    cabeca.rotation.x = Math.sin(t * 2.4) * 0.02 + mouseY * 0.06;
    // ajeita a gravata de tempos em tempos
    bracoG.rotation.x = Math.max(0, Math.sin(t * 0.9)) * 0.04;
    // telefone tocando a cada ~7 s
    if (!reduzir && t - tTrim > 7) tTrim = t;
    const gt = t - tTrim;
    estoura(trim, window.__trim ?? gt, 1.4, [0.55, 0.28]);
    linhas.visible = gt < 1.4 || window.__trim !== undefined;
    linhas.scale.setScalar(1 + Math.sin(t * 25) * 0.15);
    tel.rotation.z = 0.22 + (gt < 1 ? Math.sin(t * 60) * 0.06 : 0);
    // POW (XP) e FECHOU (venda)
    estoura(pow, window.__pow ?? t - tXp, 1.2, [0.55, 0.28]);
    estoura(fechou, window.__fechou ?? t - tVenda, 2.4, [0.95, 0.48]);
    homem.position.y = t - tVenda < 0.6 ? Math.sin(((t - tVenda) / 0.6) * Math.PI) * 0.08 : 0;
    // câmera
    camera.position.x += (camBase.x + mouseX * 0.3 - camera.position.x) * 0.05;
    camera.position.y += (camBase.y - mouseY * 0.2 - camera.position.y) * 0.05;
    camera.lookAt(alvo);
    renderer.render(cena, camera);
  };
  quadro();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("inmovya-avatar-xp", xp);
    window.removeEventListener("inmovya-avatar-venda", venda);
    ro.disconnect();
    io.disconnect();
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("pointerleave", sair);
    cena.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => (m.map?.dispose(), m.dispose()));
    });
    renderer.dispose();
    el.remove();
  };
}

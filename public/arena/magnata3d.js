// Magnata CARTOON (Three.js) — traço de desenho animado (cores chapadas + contorno), clima de prosperidade:
// terno azul, gravata dourada, celular no ouvido, joinha, em cima de uma pilha de moedas de ouro, cidade no pôr do sol.
// Uso: const desmontar = await montar(divContainer, { modo: "heroi" })
// Eventos: window "inmovya-magnata-xp" (pulinho + moedas) e "inmovya-magnata-venda" (comemora + chuva de moedas).
import * as THREE from "/vendor/three.module.min.js";

function gradienteToon() {
  const c = new Uint8Array([70, 150, 255]);
  const t = new THREE.DataTexture(c, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

function texBrilho(cor = "255,230,150") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${cor},1)`);
  r.addColorStop(0.35, `rgba(${cor},.45)`);
  r.addColorStop(1, `rgba(${cor},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function texEstrela() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.translate(32, 32);
  g.fillStyle = "#fff6c8";
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 6 : 30;
    const a = (i / 8) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  return new THREE.CanvasTexture(c);
}

function texJanelasCartoon(cor) {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = cor;
  g.fillRect(0, 0, 32, 64);
  for (let y = 4; y < 64; y += 8)
    for (let x = 4; x < 32; x += 8) {
      g.fillStyle = Math.random() < 0.55 ? "#ffe08a" : "rgba(0,0,0,.18)";
      g.fillRect(x, y, 4, 5);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
  const grad = gradienteToon();
  const toon = (cor, extra = {}) => new THREE.MeshToonMaterial({ color: cor, gradientMap: grad, ...extra });
  const contornoMat = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.BackSide });

  // céu de pôr do sol
  const ceuGeo = new THREE.SphereGeometry(80, 32, 16);
  const cores = [];
  const p = ceuGeo.attributes.position;
  const c1 = new THREE.Color("#ffcf6e"), c2 = new THREE.Color("#ff8f6b"), c3 = new THREE.Color("#7a5cc4");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 80;
    const c = y < 0.05 ? c1.clone() : y < 0.3 ? c1.clone().lerp(c2, (y - 0.05) / 0.25) : c2.clone().lerp(c3, Math.min(1, (y - 0.3) / 0.5));
    cores.push(c.r, c.g, c.b);
  }
  ceuGeo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
  cena.add(new THREE.Mesh(ceuGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho("255,240,190"), transparent: true, depthWrite: false }));
  sol.position.set(9, 5, -50);
  sol.scale.set(26, 26, 1);
  cena.add(sol);

  const camera = new THREE.PerspectiveCamera(heroi ? 34 : 30, 1, 0.1, 200);
  const alvo = heroi ? new THREE.Vector3(0, 1.12, 0) : new THREE.Vector3(0, 0.9, 0);
  const camBase = heroi ? new THREE.Vector3(0.2, 0.95, 3.6) : new THREE.Vector3(0.2, 1.2, 5.4);
  camera.position.copy(camBase);

  cena.add(new THREE.AmbientLight(0xfff0e0, 0.9));
  const sol1 = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sol1.position.set(2.5, 4, 4);
  cena.add(sol1);
  const contraluz = new THREE.DirectionalLight(0xffb070, 1.4);
  contraluz.position.set(-3, 2, -4);
  cena.add(contraluz);

  const grupo = new THREE.Group(); // personagem + moedas
  cena.add(grupo);
  const homem = new THREE.Group();
  grupo.add(homem);

  // adiciona com contorno de desenho animado
  const add = (geo, mat, x = 0, y = 0, z = 0, pai = homem, contorno = 0.018) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    pai.add(m);
    if (contorno) {
      const o = new THREE.Mesh(geo, contornoMat);
      o.scale.setScalar(1 + contorno / Math.max(0.03, geo.boundingSphere?.radius || (geo.computeBoundingSphere(), geo.boundingSphere.radius)));
      m.add(o);
    }
    return m;
  };
  const capsula = (a, b, r, mat, pai = homem) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, d.length()), 8, 18);
    const m = add(geo, mat, 0, 0, 0, pai, 0);
    m.position.copy(va).add(d.clone().multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r + 0.014, Math.max(0.001, d.length()), 8, 18), contornoMat);
    m.add(o);
    return m;
  };

  // cores
  const azul = toon(0x2f4fb8), azulEsc = toon(0x22377f), branco = toon(0xfafafa), ouro = toon(0xffc533, { emissive: 0x4a2c00 }),
    pele = toon(0xf2b48a), cabelo = toon(0x3a2416), sapato = toon(0x5a3018), preto = new THREE.MeshBasicMaterial({ color: 0x1a1020 }),
    vermelhoBoca = toon(0xb83a3a), verde = toon(0x3fbf6a);

  // ---- pilha de moedas (pedestal) ----
  const moedas = new THREE.Group();
  grupo.add(moedas);
  const moedaGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.09, 40);
  for (let i = 0; i < 4; i++) {
    const m = add(moedaGeo, ouro, (Math.random() - 0.5) * 0.06, -0.045 - i * 0.09, (Math.random() - 0.5) * 0.06, moedas, 0.012);
    m.rotation.y = Math.random();
  }
  add(new THREE.TorusGeometry(0.5, 0.02, 8, 40), toon(0xe8a520), 0, 0.001, 0, moedas, 0).rotation.x = Math.PI / 2;
  moedas.position.y = 0;
  homem.position.y = 0;

  // ---- personagem (proporção cartoon: cabeça grande) ----
  // sapatos e pernas
  for (const s of [-1, 1]) {
    const sp = add(new THREE.SphereGeometry(0.1, 20, 14), sapato, 0.12 * s, 0.06, 0.05);
    sp.scale.set(0.85, 0.6, 1.4);
    capsula([0.12 * s, 0.1, 0], [0.12 * s, 0.46, 0], 0.08, azulEsc);
  }
  // corpo: paletó em forma de ovo
  const tronco = new THREE.Group();
  homem.add(tronco);
  const corpo = add(new THREE.SphereGeometry(0.34, 32, 24), azul, 0, 0.78, 0, tronco, 0.02);
  corpo.scale.set(0.95, 1.08, 0.78);
  // camisa e gravata
  const camisaV = add(new THREE.CircleGeometry(0.14, 3), branco, 0, 0.98, 0.262, tronco, 0);
  camisaV.rotation.z = -Math.PI / 2;
  camisaV.scale.set(1.3, 0.75, 1);
  const gravata = add(new THREE.CircleGeometry(0.06, 4), ouro, 0, 0.84, 0.272, tronco, 0);
  gravata.scale.set(0.8, 2.2, 1);
  add(new THREE.SphereGeometry(0.035, 12, 10), ouro, 0, 1.0, 0.262, tronco, 0.006); // nó
  for (const y of [0.72, 0.6]) add(new THREE.SphereGeometry(0.022, 10, 8), ouro, 0.07, y, 0.26, tronco, 0.005);
  // lenço no bolso
  add(new THREE.ConeGeometry(0.035, 0.06, 3), ouro, -0.15, 0.92, 0.22, tronco, 0.005);

  // cabeça grande
  const cabeca = new THREE.Group();
  cabeca.position.set(0, 1.38, 0.02);
  tronco.add(cabeca);
  const rosto = add(new THREE.SphereGeometry(0.3, 36, 28), pele, 0, 0, 0, cabeca, 0.02);
  rosto.scale.set(1, 1.02, 0.95);
  // orelhas
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.07, 14, 10), pele, 0.29 * s, -0.02, 0, cabeca, 0.012).scale.set(0.55, 1, 0.7);
  // cabelo com topete
  const cab = add(new THREE.SphereGeometry(0.305, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), cabelo, 0, 0.03, -0.02, cabeca, 0.015);
  cab.rotation.x = -0.35;
  const topete = add(new THREE.SphereGeometry(0.13, 20, 14), cabelo, 0.06, 0.24, 0.12, cabeca, 0.012);
  topete.scale.set(1.5, 0.75, 1.1);
  topete.rotation.z = -0.3;
  // olhos grandes e confiantes
  const olhos = [];
  for (const s of [-1, 1]) {
    const o = add(new THREE.SphereGeometry(0.07, 20, 16), branco, 0.1 * s, 0.05, 0.245, cabeca, 0.01);
    o.scale.set(0.85, 1.1, 0.6);
    const pu = add(new THREE.SphereGeometry(0.035, 14, 10), preto, 0.1 * s + 0.008, 0.045, 0.285, cabeca, 0);
    pu.scale.set(1, 1.15, 0.5);
    add(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.1 * s + 0.02, 0.065, 0.302, cabeca, 0);
    olhos.push(o, pu);
    const sob = add(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), cabelo, 0.1 * s, 0.15, 0.27, cabeca, 0);
    sob.rotation.z = Math.PI / 2 + 0.18 * s;
  }
  // nariz e bigode charmoso
  add(new THREE.SphereGeometry(0.045, 16, 12), toon(0xeaa078), 0, -0.03, 0.29, cabeca, 0.008);
  for (const s of [-1, 1]) {
    const big = add(new THREE.CapsuleGeometry(0.022, 0.07, 4, 10), cabelo, 0.05 * s, -0.085, 0.27, cabeca, 0.006);
    big.rotation.z = Math.PI / 2 - 0.35 * s;
  }
  // sorriso
  const sorriso = add(new THREE.TorusGeometry(0.085, 0.018, 8, 24, Math.PI), vermelhoBoca, 0, -0.12, 0.262, cabeca, 0);
  sorriso.rotation.z = Math.PI;
  sorriso.rotation.x = -0.25;

  // braço direito da tela: joinha
  const bracoJ = new THREE.Group();
  bracoJ.position.set(0.3, 0.98, 0);
  tronco.add(bracoJ);
  capsula([0, 0, 0], [0.16, -0.22, 0.12], 0.07, azul, bracoJ);
  capsula([0.16, -0.22, 0.12], [0.2, 0.0, 0.26], 0.064, azul, bracoJ);
  add(new THREE.CylinderGeometry(0.066, 0.066, 0.04, 16), branco, 0.2, 0.015, 0.265, bracoJ, 0.006).rotation.x = -0.6; // punho
  const punho = add(new THREE.SphereGeometry(0.075, 18, 14), pele, 0.205, 0.07, 0.29, bracoJ, 0.012);
  punho.scale.set(1, 0.85, 0.9);
  capsula([0.205, 0.11, 0.3], [0.205, 0.2, 0.3], 0.026, pele, bracoJ); // polegar pra cima
  const relogio = add(new THREE.TorusGeometry(0.06, 0.016, 8, 20), ouro, 0.2, -0.02, 0.26, bracoJ, 0);
  relogio.rotation.x = Math.PI / 2 - 0.6;

  // braço esquerdo da tela: celular no ouvido
  const bracoC = new THREE.Group();
  bracoC.position.set(-0.3, 0.98, 0);
  tronco.add(bracoC);
  capsula([0, 0, 0], [-0.17, -0.17, 0.16], 0.07, azul, bracoC);
  capsula([-0.17, -0.17, 0.16], [-0.06, 0.26, 0.08], 0.064, azul, bracoC);
  const maoC = add(new THREE.SphereGeometry(0.072, 18, 14), pele, -0.05, 0.33, 0.07, bracoC, 0.012);
  maoC.scale.set(0.9, 1.05, 0.9);
  const cel = new THREE.Group();
  cel.position.set(-0.02, 0.43, 0.04);
  cel.rotation.set(0, -0.2, -0.25);
  bracoC.add(cel);
  add(new THREE.BoxGeometry(0.03, 0.22, 0.11), toon(0x222233), 0, 0, 0, cel, 0.01);
  const telaMat = new THREE.MeshBasicMaterial({ color: 0x8ee6ff });
  const tela = add(new THREE.PlaneGeometry(0.09, 0.18), telaMat, 0.016, 0, 0, cel, 0);
  tela.rotation.y = Math.PI / 2;

  // ---- cidade cartoon ao fundo ----
  const cidade = new THREE.Group();
  cena.add(cidade);
  const paleta = ["#6a5acd", "#8a6fd6", "#e07a8f", "#f0a26b", "#5b8bd9", "#4fb3a9"];
  for (let i = 0; i < 40; i++) {
    const a = Math.PI * 0.62 + Math.random() * Math.PI * 0.76;
    const dist = 26 + Math.random() * 26;
    const w = 2.2 + Math.random() * 3, h = 6 + Math.random() * 12 + (dist > 40 ? 5 : 0);
    const cor = paleta[i % paleta.length];
    const tex = texJanelasCartoon(cor);
    tex.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 2)));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), toon(0xffffff, { map: tex }));
    m.position.set(Math.sin(a) * dist, -6 + h / 2, Math.cos(a) * dist);
    cidade.add(m);
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), contornoMat);
    o.scale.set(1 + 0.08 / w, 1 + 0.08 / h, 1 + 0.08 / w);
    m.add(o);
  }
  // torre dourada da prosperidade
  const torreMat = toon(0xffcf4a, { emissive: 0x664200, emissiveIntensity: 0.3 });
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 16, 8), torreMat);
  torre.position.set(-9, 2, -40);
  cidade.add(torre);
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(1.25, 4, 8), torreMat);
  ponta.position.set(-9, 12, -40);
  cidade.add(ponta);
  const brilhoTorre = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho("255,220,120"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  brilhoTorre.position.set(-9, 13, -39.5);
  brilhoTorre.scale.set(6, 6, 1);
  cidade.add(brilhoTorre);
  // chão/horizonte
  const chao = new THREE.Mesh(new THREE.CircleGeometry(60, 48), toon(0x5a4a8a));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -6;
  cena.add(chao);

  // ---- moedas flutuando e brilhos ----
  const moedaPeq = new THREE.CylinderGeometry(0.11, 0.11, 0.025, 28);
  const flutuantes = [];
  for (let i = 0; i < 9; i++) {
    const m = add(moedaPeq, ouro, 0, 0, 0, cena, 0.006);
    m.rotation.x = Math.PI / 2;
    m.userData = { a: (i / 9) * Math.PI * 2, r: 0.95 + Math.random() * 0.3, y: 0.25 + Math.random() * 0.7, v: 0.3 + Math.random() * 0.3 };
    flutuantes.push(m);
  }
  const estrelaTex = texEstrela();
  const brilhos = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: estrelaTex, transparent: true, depthWrite: false }));
    s.position.set((Math.random() - 0.5) * 2.6, 0.2 + Math.random() * 2.2, -0.4 + Math.random() * 0.8);
    s.userData.f = Math.random() * 6;
    brilhos.push(s);
    cena.add(s);
  }
  // chuva de moedas (venda)
  const chuva = [];
  for (let i = 0; i < 40; i++) {
    const m = add(moedaPeq, ouro, 0, -99, 0, cena, 0.006);
    m.visible = false;
    chuva.push(m);
  }

  // ---- interação ----
  let rotY = -0.15, velRot = 0, arrastando = false, ultX = 0, ultInteracao = -1e9, mouseX = 0, mouseY = 0;
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
  };
  ajustar();
  const ro = new ResizeObserver(ajustar);
  ro.observe(container);
  let visivel = true;
  const io = new IntersectionObserver((es) => (visivel = es[0]?.isIntersecting ?? true));
  io.observe(container);

  const relogioT = new THREE.Clock();
  let tXp = -10, tVenda = -10;
  const xp = () => (tXp = relogioT.getElapsedTime());
  const venda = () => {
    tVenda = relogioT.getElapsedTime();
    chuva.forEach((m) => {
      m.visible = true;
      m.position.set((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 1.5);
      m.userData.v = 0.02 + Math.random() * 0.03;
      m.userData.g = Math.random() * 0.2;
    });
  };
  window.addEventListener("inmovya-magnata-xp", xp);
  window.addEventListener("inmovya-magnata-venda", venda);
  const suave = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  const quadro = () => {
    raf = requestAnimationFrame(quadro);
    if (!visivel || document.hidden) return;
    const t = window.__t ?? relogioT.getElapsedTime();
    if (!arrastando) {
      velRot *= 0.93;
      rotY += velRot;
      if (!reduzir && performance.now() - ultInteracao > 2500) rotY += (-0.15 + Math.sin(t * 0.3) * 0.35 - rotY) * 0.02;
    }
    grupo.rotation.y = rotY;
    // balanço feliz
    const gx = t - tXp, gv = t - tVenda;
    const pulo = Math.sin(Math.min(1, gx / 0.5) * Math.PI) * 0.18 * (gx < 0.5 ? 1 : 0) + (gv < 1.5 ? Math.abs(Math.sin(gv * 6)) * 0.25 * (1 - gv / 1.5) : 0);
    homem.position.y = Math.abs(Math.sin(t * 2.2)) * 0.025 + pulo;
    tronco.rotation.z = Math.sin(t * 1.1) * 0.03;
    cabeca.rotation.y = Math.sin(t * 0.7) * 0.18 + mouseX * 0.25;
    cabeca.rotation.x = Math.sin(t * 2.2) * 0.04 + mouseY * 0.08;
    // joinha balançando; na venda, soco no ar
    const comemora = gv < 2 ? suave(0, 0.2, gv) * (1 - suave(1.4, 2, gv)) : 0;
    bracoJ.rotation.z = Math.sin(t * 3) * 0.06 + comemora * 1.6;
    bracoJ.rotation.x = -comemora * 0.4;
    bracoC.rotation.z = Math.sin(t * 1.6) * 0.04;
    // piscar
    const pisca = (t % 4) < 0.12 ? 0.1 : 1;
    olhos.forEach((o) => (o.scale.y = (o.geometry.parameters.radius > 0.05 ? 1.1 : 1.15) * pisca));
    telaMat.color.setHSL(0.53, 0.9, 0.7 + Math.sin(t * 4) * 0.08);
    // moedas girando em volta
    flutuantes.forEach((m) => {
      const u = m.userData;
      const a = u.a + t * u.v;
      m.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.5 + u.a) * 0.08 + homem.position.y, Math.sin(a) * u.r * 0.6);
      m.rotation.z = t * 3 + u.a;
    });
    brilhos.forEach((s) => {
      const k = Math.max(0, Math.sin(t * 2 + s.userData.f));
      s.scale.setScalar(0.04 + k * 0.12);
      s.material.rotation = t + s.userData.f;
    });
    // chuva de moedas
    chuva.forEach((m) => {
      if (!m.visible) return;
      m.position.y -= m.userData.v;
      m.rotation.x += 0.15;
      m.rotation.z += 0.1;
      if (m.position.y < -0.5) m.visible = false;
    });
    torreMat.emissiveIntensity = 0.3 + (gv < 5 ? (1 - gv / 5) * 1.5 : 0) + Math.sin(t * 1.5) * 0.08;
    brilhoTorre.scale.setScalar(6 + Math.sin(t * 1.5) * 0.6 + (gv < 5 ? (1 - gv / 5) * 8 : 0));
    // câmera
    camera.position.x += (camBase.x + mouseX * 0.35 - camera.position.x) * 0.05;
    camera.position.y += (camBase.y - mouseY * 0.2 - camera.position.y) * 0.05;
    camera.lookAt(alvo);
    renderer.render(cena, camera);
  };
  quadro();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("inmovya-magnata-xp", xp);
    window.removeEventListener("inmovya-magnata-venda", venda);
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

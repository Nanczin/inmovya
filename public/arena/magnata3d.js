// Magnata 3D (Three.js) — no terraço de um arranha-céu à noite, falando ao telefone, com a cidade atrás.
// Uso: const desmontar = await montar(divContainer, { modo: "heroi" })
import * as THREE from "/vendor/three.module.min.js";

function texJanelas(acesas = 0.35) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#07080c";
  g.fillRect(0, 0, 64, 128);
  for (let y = 2; y < 128; y += 6) {
    for (let x = 2; x < 64; x += 5) {
      const r = Math.random();
      if (r < acesas) {
        const quente = Math.random() < 0.8;
        g.fillStyle = quente ? `hsl(${38 + Math.random() * 10}, 90%, ${55 + Math.random() * 25}%)` : `hsl(200, 60%, ${60 + Math.random() * 20}%)`;
      } else g.fillStyle = `rgba(30,35,50,${0.4 + Math.random() * 0.4})`;
      g.fillRect(x, y, 3, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function texBrilho(cor = "255,210,140") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${cor},1)`);
  r.addColorStop(0.3, `rgba(${cor},.5)`);
  r.addColorStop(1, `rgba(${cor},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function texTecido() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) {
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
    g.fillRect(i, 0, 1, 128);
    g.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
    g.fillRect(0, i, 128, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

export async function montar(container, opcoes = {}) {
  const { modo = "heroi" } = opcoes;
  const heroi = modo === "heroi";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog(0x0a0d18, 40, 170);

  // céu
  const ceuGeo = new THREE.SphereGeometry(190, 32, 16);
  const cores = [];
  const p = ceuGeo.attributes.position;
  const cAlto = new THREE.Color("#04050c"), cMeio = new THREE.Color("#141a33"), cHoriz = new THREE.Color("#3a2a3a");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 190;
    const c = y > 0.12 ? cMeio.clone().lerp(cAlto, Math.min(1, (y - 0.12) * 2)) : cHoriz.clone().lerp(cMeio, Math.max(0, (y + 0.1) / 0.22));
    cores.push(c.r, c.g, c.b);
  }
  ceuGeo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
  cena.add(new THREE.Mesh(ceuGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  // lua
  const lua = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho("230,235,255"), fog: false, transparent: true, depthWrite: false }));
  lua.position.set(-50, 55, -140);
  lua.scale.set(22, 22, 1);
  cena.add(lua);

  const camera = new THREE.PerspectiveCamera(heroi ? 36 : 32, 1, 0.1, 400);
  const alvo = heroi ? new THREE.Vector3(0, 1.5, 0) : new THREE.Vector3(0, 1.1, 0);
  const camBase = heroi ? new THREE.Vector3(0.35, 0.75, 3.1) : new THREE.Vector3(0.3, 1.3, 5.6);
  camera.position.copy(camBase);

  // luzes: lua fria por trás, brilho quente da cidade por baixo, tela do celular no rosto
  cena.add(new THREE.HemisphereLight(0x3a4670, 0x2a1a10, 0.35));
  const luaLuz = new THREE.DirectionalLight(0xbcd0ff, 3.0);
  luaLuz.position.set(-3, 5, -5);
  cena.add(luaLuz);
  const chave = new THREE.DirectionalLight(0xffe2c0, 0.55);
  chave.position.set(3, 3, 4);
  chave.castShadow = true;
  chave.shadow.mapSize.set(1024, 1024);
  cena.add(chave);
  const cidadeLuz = new THREE.PointLight(0xffa860, 4, 8, 1.5);
  cidadeLuz.position.set(0, -0.5, 1.5);
  cena.add(cidadeLuz);

  // materiais
  const tecido = texTecido();
  const terno = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.78, metalness: 0.05, bumpMap: tecido, bumpScale: 0.002 });
  const camisa = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.6 });
  const pele = new THREE.MeshStandardMaterial({ color: 0x6a4535, roughness: 0.65 });
  const cabelo = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.45, metalness: 0.2 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.22 });
  const oculos = new THREE.MeshStandardMaterial({ color: 0x020203, metalness: 0.9, roughness: 0.05 });
  const sapato = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.3, roughness: 0.25 });
  const concreto = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.85, metalness: 0 });

  const homem = new THREE.Group();
  cena.add(homem);
  const add = (geo, mat, x = 0, y = 0, z = 0, pai = homem) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    pai.add(m);
    return m;
  };
  const membro = (a, b, r1, r2, mat, pai = homem) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, d.length(), 18), mat);
    m.position.copy(va).add(d.clone().multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.castShadow = true;
    pai.add(m);
    add(new THREE.SphereGeometry(Math.max(r1, r2) * 0.98, 16, 12), mat, ...b, pai);
    return m;
  };

  // pernas e sapatos
  for (const s of [-1, 1]) {
    membro([0.12 * s, 0.08, 0], [0.12 * s, 0.52, 0], 0.075, 0.085, terno);
    membro([0.12 * s, 0.52, 0], [0.11 * s, 0.98, 0], 0.09, 0.11, terno);
    const sp = add(new THREE.BoxGeometry(0.11, 0.07, 0.28), sapato, 0.12 * s, 0.035, 0.05);
    sp.geometry.translate(0, 0, 0);
  }
  // tronco: paletó
  const tronco = new THREE.Group();
  homem.add(tronco);
  const perfil = [
    [0.2, 0.92], [0.255, 0.98], [0.27, 1.1], [0.29, 1.25], [0.33, 1.4], [0.36, 1.5], [0.34, 1.56], [0.22, 1.6], [0.08, 1.62],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const paleto = add(new THREE.LatheGeometry(perfil, 40), terno, 0, 0, 0, tronco);
  paleto.scale.z = 0.62;
  // V da camisa e lapelas
  const vCamisa = add(new THREE.ConeGeometry(0.1, 0.36, 3), camisa, 0, 1.43, 0.17, tronco);
  vCamisa.rotation.x = Math.PI;
  vCamisa.scale.z = 0.3;
  for (const s of [-1, 1]) {
    const lap = add(new THREE.BoxGeometry(0.08, 0.32, 0.015), terno, 0.075 * s, 1.42, 0.2, tronco);
    lap.rotation.z = 0.32 * s;
    lap.rotation.y = 0.25 * s;
    add(new THREE.SphereGeometry(0.012, 8, 6), ouro, 0, 1.2 - (s > 0 ? 0.1 : 0), 0.205, tronco); // botões
  }
  // ombros com ombreira de alfaiataria
  for (const s of [-1, 1]) {
    const o = add(new THREE.SphereGeometry(0.13, 20, 14), terno, 0.34 * s, 1.5, 0, tronco);
    o.scale.set(1.15, 0.7, 0.85);
  }
  add(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 14), pele, 0, 1.66, 0.01, tronco);
  // colarinho
  const gola = add(new THREE.TorusGeometry(0.075, 0.018, 8, 20), camisa, 0, 1.62, 0.01, tronco);
  gola.rotation.x = Math.PI / 2;

  // cabeça
  const cabeca = new THREE.Group();
  cabeca.position.set(0, 1.83, 0.01);
  tronco.add(cabeca);
  const cranio = add(new THREE.SphereGeometry(0.12, 28, 20), pele, 0, 0, 0, cabeca);
  cranio.scale.set(0.92, 1.12, 1.0);
  const mandibula = add(new THREE.BoxGeometry(0.17, 0.09, 0.15), pele, 0, -0.085, 0.02, cabeca);
  mandibula.geometry.translate(0, 0, 0);

  add(new THREE.BoxGeometry(0.03, 0.06, 0.04), pele, 0, -0.01, 0.12, cabeca); // nariz
  // cabelo penteado para trás
  const cab = add(new THREE.SphereGeometry(0.128, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), cabelo, 0, 0.012, -0.008, cabeca);
  cab.scale.set(0.95, 1.12, 1.05);
  cab.rotation.x = -0.25;
  // chapéu (fedora): deixa o rosto na sombra
  const chapeu = new THREE.Group();
  chapeu.position.set(0, 0.09, -0.005);
  chapeu.rotation.x = 0.12;
  cabeca.add(chapeu);
  const feltro = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.85 });
  const aba = add(new THREE.CylinderGeometry(0.21, 0.21, 0.012, 40), feltro, 0, 0, 0, chapeu);
  aba.scale.z = 1.12;
  const copa = add(new THREE.CylinderGeometry(0.11, 0.13, 0.13, 32), feltro, 0, 0.07, 0, chapeu);
  copa.scale.z = 1.15;
  const amassado = add(new THREE.BoxGeometry(0.03, 0.03, 0.2), feltro, 0, 0.135, 0, chapeu);
  add(new THREE.CylinderGeometry(0.131, 0.131, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x3a2a12, roughness: 0.5, metalness: 0.4 }), 0, 0.022, 0, chapeu).scale.z = 1.15;
  // orelhas
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.025, 10, 8), pele, 0.112 * s, 0, 0, cabeca).scale.set(0.5, 1.2, 0.8);
  // óculos escuros refletindo a cidade
  for (const s of [-1, 1]) {
    const lente = add(new THREE.BoxGeometry(0.075, 0.04, 0.01), oculos, 0.045 * s, 0.025, 0.118, cabeca);
    lente.rotation.y = 0.18 * s;
  }
  add(new THREE.BoxGeometry(0.22, 0.008, 0.008), ouro, 0, 0.045, 0.117, cabeca);


  // braço direito (da tela: esquerdo do corpo dele) segurando o celular no ouvido
  const ombroT = [-0.36, 1.48, 0];
  const cotT = [-0.42, 1.18, 0.12];
  const maoT = [-0.16, 1.76, 0.06];
  const bracoT = new THREE.Group();
  homem.add(bracoT);
  membro(ombroT, cotT, 0.085, 0.078, terno, bracoT);
  membro(cotT, [-0.2, 1.68, 0.08], 0.072, 0.062, terno, bracoT);
  add(new THREE.CylinderGeometry(0.066, 0.064, 0.03, 14), camisa, -0.21, 1.66, 0.08, bracoT); // punho
  add(new THREE.SphereGeometry(0.05, 14, 10), pele, ...maoT, bracoT).scale.set(0.9, 1.2, 0.7);
  add(new THREE.SphereGeometry(0.012, 8, 6), ouro, -0.215, 1.67, 0.13, bracoT); // abotoadura
  // celular
  const cel = new THREE.Group();
  cel.position.set(-0.12, 1.8, 0.05);
  cel.rotation.set(0.1, -0.5, 0.25);
  bracoT.add(cel);
  add(new THREE.BoxGeometry(0.012, 0.15, 0.072), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 }), 0, 0, 0, cel);
  const telaMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff });
  const tela = add(new THREE.PlaneGeometry(0.064, 0.14), telaMat, -0.0065, 0, 0, cel);
  tela.rotation.y = -Math.PI / 2;
  const luzTela = new THREE.PointLight(0x9fd0ff, 0.35, 0.4, 2);
  luzTela.position.set(-0.05, 0, 0.05);
  cel.add(luzTela);

  // braço esquerdo da tela: mão no bolso, relógio de ouro
  membro([0.36, 1.48, 0], [0.4, 1.17, -0.02], 0.085, 0.078, terno);
  membro([0.4, 1.17, -0.02], [0.27, 0.98, 0.1], 0.072, 0.064, terno);
  const rel = add(new THREE.TorusGeometry(0.06, 0.012, 8, 20), ouro, 0.29, 1.0, 0.09);
  rel.rotation.set(0.8, 0.4, 0.6);

  // terraço: piso e parapeito de vidro com corrimão
  add(new THREE.BoxGeometry(8, 0.1, 6), concreto, 0, -0.05, -1, cena).receiveShadow = true;
  const vidro = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.12 });
  add(new THREE.BoxGeometry(8, 1.0, 0.02), vidro, 0, 0.5, -1.4, cena);
  add(new THREE.BoxGeometry(8, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: 0x99a0aa, metalness: 1, roughness: 0.3 }), 0, 1.0, -1.4, cena);

  // ---- cidade ----
  const cidade = new THREE.Group();
  cena.add(cidade);
  const janelas = [texJanelas(0.25), texJanelas(0.4), texJanelas(0.55)];
  const predios = [];
  const luzesTopo = [];
  const BASE = -70;
  for (let i = 0; i < 220; i++) {
    const a = Math.PI * 0.55 + Math.random() * Math.PI * 0.9; // atrás e dos lados
    const dist = 45 + Math.random() * 110;
    const w = 4 + Math.random() * 8, d = 4 + Math.random() * 8;
    const h = 45 + Math.random() * 45 + (dist > 110 ? 25 : 0);
    const tex = janelas[i % 3].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 9)));
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.4 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(Math.sin(a) * dist, BASE + h / 2, Math.cos(a) * dist);
    m.rotation.y = Math.random() * 0.4;
    cidade.add(m);
    predios.push(m);
    if (Math.random() < 0.35) {
      const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho("255,40,30"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      l.position.set(m.position.x, BASE + h + 1, m.position.z);
      l.scale.set(2.2, 2.2, 1);
      l.userData.fase = Math.random() * 6;
      cidade.add(l);
      luzesTopo.push(l);
    }
  }
  // torre dourada (acende com as vendas)
  const torreMat = new THREE.MeshStandardMaterial({ color: 0x1a140a, emissive: 0xffb347, emissiveIntensity: 0.12, metalness: 0.9, roughness: 0.25 });
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 120, 6), torreMat);
  torre.position.set(-30, BASE + 60, -110);
  cidade.add(torre);
  const pontaTorre = new THREE.Mesh(new THREE.ConeGeometry(1.8, 10, 6), torreMat);
  pontaTorre.position.set(-30, BASE + 125, -110);
  pontaTorre.scale.set(1.7, 1.2, 1.7);
  cidade.add(pontaTorre);
  // holofotes
  const holofotes = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.CylinderGeometry(0.4, 9, 160, 16, 1, true);
    g.translate(0, 80, 0);
    const h = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    h.position.set(-30, BASE + 130, -110);
    cena.add(h);
    holofotes.push(h);
  }
  // helicóptero (luz piscando cruzando o céu)
  const heli = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho("255,255,255"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  heli.scale.set(2.5, 2.5, 1);
  cena.add(heli);

  // ---- interação ----
  let rotY = 0.35, velRot = 0, arrastando = false, ultX = 0, ultInteracao = -1e9, mouseX = 0, mouseY = 0;
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

  // venda: torre acende em dourado
  let tVenda = -10;
  const venda = () => (tVenda = relogio.getElapsedTime());
  window.addEventListener("inmovya-magnata-venda", venda);

  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const relogio = new THREE.Clock();
  let raf = 0;
  const quadro = () => {
    raf = requestAnimationFrame(quadro);
    if (!visivel || document.hidden) return;
    const t = window.__t ?? relogio.getElapsedTime();
    if (!arrastando) {
      velRot *= 0.93;
      rotY += velRot;
      if (!reduzir && performance.now() - ultInteracao > 2500) rotY += (0.35 + Math.sin(t * 0.25) * 0.3 - rotY) * 0.02;
    }
    homem.rotation.y = rotY;
    // respiração, fala ao telefone, olha a cidade e você
    const resp = Math.sin(t * 1.5);
    tronco.scale.set(1 + resp * 0.005, 1 + resp * 0.003, 1 + resp * 0.008);
    cabeca.rotation.y = Math.sin(t * 0.4) * 0.35 + mouseX * 0.2;
    cabeca.rotation.x = 0.05 + Math.sin(t * 2.3) * 0.015 + mouseY * 0.05;
    cabeca.rotation.z = Math.sin(t * 0.7) * 0.03;
    telaMat.color.setHSL(0.58, 0.8, 0.65 + Math.sin(t * 3) * 0.05);
    // venda
    const v = Math.max(0, 1 - Math.max(0, t - tVenda) / 6);
    torreMat.emissiveIntensity = 0.1 + v * 1.4 + Math.sin(t * 0.8) * 0.03;
    holofotes.forEach((h, i) => {
      h.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.45;
      h.rotation.x = Math.cos(t * 0.4 + i) * 0.15;
      h.material.opacity = v * 0.1;
      h.visible = v > 0.01;
    });
    luzesTopo.forEach((l) => (l.material.opacity = Math.sin(t * 2 + l.userData.fase) > 0.6 ? 1 : 0.15));
    // helicóptero
    const hx = ((t * 1.6) % 90) - 45;
    heli.position.set(hx * 3, 30 + Math.sin(t * 0.3) * 3, -120);
    heli.material.opacity = Math.sin(t * 8) > 0 ? 1 : 0.3;
    // câmera
    camera.position.x += (camBase.x + mouseX * 0.4 - camera.position.x) * 0.05;
    camera.position.y += (camBase.y - mouseY * 0.25 - camera.position.y) * 0.05;
    camera.position.z = camBase.z - (heroi ? Math.sin(t * 0.2) * 0.12 : 0);
    camera.lookAt(alvo);
    renderer.render(cena, camera);
  };
  quadro();

  return () => {
    cancelAnimationFrame(raf);
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
      if (o.material) [].concat(o.material).forEach((m) => (m.map?.dispose(), m.emissiveMap?.dispose(), m.dispose()));
    });
    renderer.dispose();
    el.remove();
  };
}

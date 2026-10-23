// Spartano 3D (Three.js) — modelo feito em código: capacete coríntio com crista, couraça, capa, escudo com Λ e lança.
// Uso: const desmontar = await montar(divContainer, { autoGiro: true })
import * as THREE from "/vendor/three.module.min.js";

function ambiente(renderer) {
  // "estúdio" quente para o bronze ter reflexo
  const cena = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const cores = [];
  const pos = geo.attributes.position;
  const cTopo = new THREE.Color("#8a8070"), cMeio = new THREE.Color("#1c1410"), cBase = new THREE.Color("#030202");
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const c = y > 0 ? cMeio.clone().lerp(cTopo, y) : cMeio.clone().lerp(cBase, -y);
    cores.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
  cena.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const painel = (cor, x, y, z, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    cena.add(m);
  };
  painel("#d8d0c0", -5, 6, 3, 3, 2);
  painel("#7a0a06", 6, -1, -4, 3, 4);
  painel("#b0a898", 3, 7, -3, 2, 2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(cena, 0.04).texture;
  pm.dispose();
  return tex;
}

function texturaCrina() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const g = c.getContext("2d");
  g.fillStyle = "#4a0508";
  g.fillRect(0, 0, 128, 16);
  for (let i = 0; i < 128; i++) {
    const l = 20 + Math.random() * 40;
    g.fillStyle = `hsl(${355 + Math.random() * 8}, ${60 + Math.random() * 25}%, ${l * 0.55}%)`;
    g.fillRect(i, 0, 1, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaDesgaste() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  // manchas de sujeira/oxidação
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 4 + Math.random() * 28;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.random() < 0.5 ? 30 : 200;
    gr.addColorStop(0, `rgba(${v},${v},${v},${0.12 + Math.random() * 0.2})`);
    gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }
  // arranhões
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI, l = 4 + Math.random() * 40;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${0.15 + Math.random() * 0.35})`;
    g.lineWidth = 0.5 + Math.random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function texturaBrasa() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,200,170,1)");
  r.addColorStop(0.3, "rgba(230,50,20,.9)");
  r.addColorStop(1, "rgba(120,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export async function montar(container, opcoes = {}) {
  const { autoGiro = true, giroInicial = -0.35, modo = "inteiro", golpes = true } = opcoes;
  const heroi = modo === "heroi";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.environment = ambiente(renderer);
  cena.fog = new THREE.FogExp2(0x0a0605, 0.12);
  const camera = new THREE.PerspectiveCamera(heroi ? 36 : 30, 1, 0.1, 50);
  // herói: câmera baixa olhando para cima (imponente), enquadrando da cintura para cima
  const alvo = heroi ? new THREE.Vector3(0, 1.78, 0) : new THREE.Vector3(0, 1.3, 0);
  const camBase = heroi ? new THREE.Vector3(0, 0.8, 3.35) : new THREE.Vector3(0, 1.75, 7.4);
  camera.position.copy(camBase);
  camera.lookAt(alvo);

  // luzes
  cena.add(new THREE.HemisphereLight(0x8a8478, 0x0a0303, 0.18));
  const chave = new THREE.DirectionalLight(0xffe6c8, 2.0);
  chave.position.set(-3, 5, 4);
  chave.castShadow = true;
  chave.shadow.mapSize.set(1024, 1024);
  chave.shadow.camera.left = -2;
  chave.shadow.camera.right = 2;
  chave.shadow.camera.top = 3.5;
  chave.shadow.camera.bottom = -0.5;
  chave.shadow.bias = -0.0008;
  cena.add(chave);
  const contorno = new THREE.DirectionalLight(0xc8d4ff, 3.2); // contraluz fria (silhueta)
  contorno.position.set(3, 3, -4);
  cena.add(contorno);
  const contorno2 = new THREE.DirectionalLight(0xff2a10, 2.4); // contraluz vermelha
  contorno2.position.set(-4, 2, -3);
  cena.add(contorno2);
  const tocha = new THREE.PointLight(0xff2a0a, 3.5, 5, 1.6); // luz de baixo, vermelha (sinistra)
  tocha.position.set(0.2, 0.15, 1.3);
  const luzOlhos = new THREE.PointLight(0xff1a00, 0.5, 0.7, 2);
  cena.add(luzOlhos);
  const relampago = new THREE.DirectionalLight(0xdfe6ff, 0);
  relampago.position.set(2, 6, 3);
  cena.add(relampago);
  cena.add(tocha);

  // materiais
  const desgaste = texturaDesgaste();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a6c48, metalness: 0.88, roughness: 0.5, roughnessMap: desgaste, bumpMap: desgaste, bumpScale: 0.006 });
  const bronzeEsc = new THREE.MeshStandardMaterial({ color: 0x3e2e1c, metalness: 0.85, roughness: 0.6, roughnessMap: desgaste, bumpMap: desgaste, bumpScale: 0.006 });
  const pele = new THREE.MeshStandardMaterial({ color: 0x5e3e2c, roughness: 0.75, metalness: 0.0, bumpMap: desgaste, bumpScale: 0.004 });
  const couro = new THREE.MeshStandardMaterial({ color: 0x1e120a, roughness: 0.9, bumpMap: desgaste, bumpScale: 0.004 });
  const vermelho = new THREE.MeshStandardMaterial({ color: 0x3e0406, roughness: 0.9, side: THREE.DoubleSide, bumpMap: desgaste, bumpScale: 0.01 });
  const crinaTex = texturaCrina();
  const crina = new THREE.MeshStandardMaterial({ map: crinaTex, bumpMap: crinaTex, bumpScale: 0.004, roughness: 0.95 });
  const preto = new THREE.MeshStandardMaterial({ color: 0x050302, roughness: 1 });
  const madeira = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 0.8, bumpMap: desgaste, bumpScale: 0.004 });
  const aco = new THREE.MeshStandardMaterial({ color: 0xb0aaa0, metalness: 1, roughness: 0.25, roughnessMap: desgaste });
  const olhoMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const lambdaMat = new THREE.MeshStandardMaterial({ color: 0x4a0306, roughness: 0.7, metalness: 0.2, bumpMap: desgaste, bumpScale: 0.01 });

  const guerreiro = new THREE.Group();
  cena.add(guerreiro);
  const sombras = (o) => o.traverse((m) => m.isMesh && ((m.castShadow = true), (m.receiveShadow = true)));
  const add = (geo, mat, x = 0, y = 0, z = 0, pai = guerreiro) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    pai.add(m);
    return m;
  };
  // cilindro ligando dois pontos (membros)
  const membro = (a, b, r1, r2, mat, pai = guerreiro) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, d.length(), 16), mat);
    m.position.copy(va).add(d.clone().multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    pai.add(m);
    add(new THREE.SphereGeometry(Math.max(r1, r2) * 0.98, 14, 10), mat, ...b, pai); // articulação
    return m;
  };

  // ---- pernas ----
  for (const s of [-1, 1]) {
    const x = 0.14 * s;
    add(new THREE.BoxGeometry(0.13, 0.07, 0.28), couro, x, 0.035, 0.05);
    membro([x, 0.07, 0], [x, 0.56, 0.01], 0.065, 0.075, pele);
    // grevas de bronze
    const greva = add(new THREE.CylinderGeometry(0.088, 0.075, 0.42, 18, 1, true, -Math.PI * 0.75, Math.PI * 1.5), bronze, x, 0.32, 0.012);
    greva.material = bronze;
    membro([x, 0.56, 0.01], [x * 0.95, 1.0, 0], 0.085, 0.11, pele);
  }
  // saiote de tiras de couro (ptéruges)
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const t = add(new THREE.BoxGeometry(0.075, 0.3, 0.02), couro, Math.sin(a) * 0.28, 0.93, Math.cos(a) * 0.21);
    t.rotation.y = a;
    t.rotation.x = 0.12;
    add(new THREE.SphereGeometry(0.012, 6, 6), bronze, Math.sin(a) * 0.29, 0.83, Math.cos(a) * 0.225);
  }
  const cinto = add(new THREE.TorusGeometry(0.29, 0.035, 10, 40), bronzeEsc, 0, 1.08, 0);
  cinto.rotation.x = Math.PI / 2;
  cinto.scale.y = 0.74;

  // ---- tronco: couraça anatômica ----
  const tronco = new THREE.Group();
  guerreiro.add(tronco);
  const perfil = [
    [0.28, 1.06], [0.3, 1.14], [0.3, 1.26], [0.32, 1.38], [0.34, 1.48], [0.33, 1.56], [0.25, 1.63], [0.12, 1.67], [0.08, 1.68],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const couraca = add(new THREE.LatheGeometry(perfil, 40), bronze, 0, 0, 0, tronco);
  couraca.scale.z = 0.72;
  for (const s of [-1, 1]) {
    const peito = add(new THREE.SphereGeometry(0.13, 20, 14), bronze, 0.11 * s, 1.45, 0.17, tronco);
    peito.scale.set(1, 0.62, 0.45);
    for (let k = 0; k < 3; k++) {
      const ab = add(new THREE.SphereGeometry(0.06, 14, 10), bronze, 0.06 * s, 1.31 - k * 0.075, 0.2 - k * 0.002, tronco);
      ab.scale.set(1, 0.6, 0.38);
    }
  }
  add(new THREE.BoxGeometry(0.012, 0.32, 0.03), bronzeEsc, 0, 1.3, 0.205, tronco);

  // ombros e pescoço
  for (const s of [-1, 1]) {
    const o = add(new THREE.SphereGeometry(0.145, 20, 14), bronze, 0.37 * s, 1.58, 0, tronco);
    o.scale.set(1.05, 0.78, 1);
    // ombreira em camadas
    const om = add(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), bronzeEsc, 0.38 * s, 1.6, 0, tronco);
    om.scale.set(1, 0.55, 0.95);
    om.rotation.z = -0.35 * s;
  }
  add(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 14), pele, 0, 1.73, 0, tronco);

  // ---- capa ----
  const capaGeo = new THREE.PlaneGeometry(0.95, 1.6, 16, 26);
  capaGeo.translate(0, -0.8, 0);
  const base = capaGeo.attributes.position.array.slice();
  const capa = add(capaGeo, vermelho, 0, 1.62, -0.2);
  capa.rotation.x = 0.1;
  const ondularCapa = (t) => {
    const p = capaGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], y = base[i + 1];
      const queda = -y / 1.6; // 0 no ombro, 1 embaixo
      p[i] = x * (1 + queda * 0.35);
      p[i + 2] = x * x * 0.9 - queda * 0.16 + Math.sin(t * 1.7 + y * 3.2 + x * 2.4) * 0.05 * queda + Math.sin(t * 2.6 + x * 5) * 0.02 * queda;
    }
    capaGeo.attributes.position.needsUpdate = true;
    capaGeo.computeVertexNormals();
  };
  ondularCapa(0);

  // ---- cabeça: capacete coríntio ----
  const cabeca = new THREE.Group();
  cabeca.position.set(0, 1.93, 0.01);
  cabeca.scale.setScalar(1.24);
  cabeca.position.y = 1.95;
  tronco.add(cabeca);
  luzOlhos.position.set(0, 0.02, 0.5);
  cabeca.add(luzOlhos);
  const perfilElmo = [
    [0.155, -0.2], [0.18, -0.16], [0.195, -0.08], [0.2, 0.0], [0.205, 0.06], [0.19, 0.13], [0.155, 0.19], [0.09, 0.235], [0.001, 0.25],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const elmo = add(new THREE.LatheGeometry(perfilElmo, 48), bronze, 0, 0, 0, cabeca);
  elmo.scale.z = 1.12;
  elmo.material = bronze.clone();
  elmo.material.side = THREE.DoubleSide;
  // fendas dos olhos (escuras) e brilho de brasa dentro
  const olhos = [], halos = [];
  const texOlho = texturaBrasa();
  for (const s of [-1, 1]) {
    const f = add(new THREE.SphereGeometry(1, 16, 10), preto, 0.06 * s, 0.025, 0.19, cabeca);
    f.scale.set(0.055, 0.022, 0.05);
    f.rotation.z = 0.38 * s;
    f.rotation.y = 0.35 * s;
    const o = add(new THREE.SphereGeometry(0.02, 10, 8), olhoMat, 0.06 * s, 0.025, 0.215, cabeca);
    olhos.push(o);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOlho, color: 0xff1a00, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(0.062 * s, 0.025, 0.24);
    halo.scale.set(0.16, 0.09, 1);
    cabeca.add(halo);
    halos.push(halo);
  }
  // abertura vertical da boca entre as bochecheiras
  add(new THREE.BoxGeometry(0.05, 0.17, 0.09), preto, 0, -0.115, 0.195, cabeca);
  // nasal
  const nasal = add(new THREE.BoxGeometry(0.03, 0.12, 0.035), bronze, 0, -0.03, 0.228, cabeca);
  nasal.rotation.x = -0.12;
  // sobrancelha em relevo
  const arcoG = new THREE.Group();
  arcoG.position.y = 0.065;
  arcoG.scale.z = 1.12;
  const arc = Math.PI * 0.62;
  arcoG.rotation.y = -Math.PI / 2 - arc / 2;
  cabeca.add(arcoG);
  for (const s of [-1, 1]) {
    const sb = add(new THREE.BoxGeometry(0.13, 0.028, 0.05), bronzeEsc, 0.068 * s, 0.062, 0.2, cabeca);
    sb.rotation.z = 0.42 * s;
    sb.rotation.y = 0.32 * s;
    // bochecheiras salientes, terminando em ponta
    const boc = add(new THREE.ConeGeometry(0.06, 0.2, 4), bronze, 0.075 * s, -0.12, 0.19, cabeca);
    boc.rotation.x = Math.PI;
    boc.rotation.y = Math.PI / 4;
    boc.scale.set(1, 1, 0.45);
    boc.rotation.z = -0.12 * s;
  }
  // borda inferior
  const bordaElmo = add(new THREE.TorusGeometry(0.157, 0.01, 8, 40), bronzeEsc, 0, -0.2, 0, cabeca);
  bordaElmo.rotation.x = Math.PI / 2;
  bordaElmo.scale.y = 1.12;
  // suporte e crista de crina (da frente para trás)
  add(new THREE.BoxGeometry(0.035, 0.05, 0.16), bronzeEsc, 0, 0.27, 0, cabeca);
  const forma = new THREE.Shape();
  forma.moveTo(-0.4, 0.02);
  forma.quadraticCurveTo(-0.14, 0.78, 0.3, 0.26);
  forma.quadraticCurveTo(0.33, 0.14, 0.22, 0.13);
  forma.quadraticCurveTo(-0.04, 0.4, -0.32, -0.14);
  forma.lineTo(-0.4, 0.02);
  const cristaGeo = new THREE.ExtrudeGeometry(forma, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 24 });
  cristaGeo.translate(0, 0, -0.05);
  const crista = new THREE.Mesh(cristaGeo, crina);
  crista.rotation.y = -Math.PI / 2;
  crista.position.set(0, 0.24, -0.02);
  const cristaPivo = new THREE.Group();
  cristaPivo.add(crista);
  cabeca.add(cristaPivo);
  // volume: segunda camada e fios ao longo do arco
  const crista2 = new THREE.Mesh(cristaGeo, crina);
  crista2.rotation.y = -Math.PI / 2;
  crista2.position.set(0, 0.235, -0.02);
  crista2.scale.set(1.05, 1.06, 0.75);
  cristaPivo.add(crista2);
  for (let i = 0; i < 90; i++) {
    const t = Math.random();
    const ax = (1 - t) * (1 - t) * -0.4 + 2 * (1 - t) * t * -0.14 + t * t * 0.3;
    const ay = (1 - t) * (1 - t) * 0.02 + 2 * (1 - t) * t * 0.78 + t * t * 0.26;
    const dx = 2 * (1 - t) * (-0.14 + 0.4) + 2 * t * (0.3 + 0.14);
    const dy = 2 * (1 - t) * (0.78 - 0.02) + 2 * t * (0.26 - 0.78);
    const fio = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05 + Math.random() * 0.05, 0.012), crina);
    fio.position.set(ax, ay, (Math.random() - 0.5) * 0.12);
    fio.rotation.z = Math.atan2(dy, dx) + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    crista.add(fio);
  }
  // fios soltos na ponta de trás
  for (let i = 0; i < 14; i++) {
    const fio = add(new THREE.BoxGeometry(0.008, 0.16 + Math.random() * 0.08, 0.008), crina, (Math.random() - 0.5) * 0.06, 0.2, -0.32 - Math.random() * 0.03, cristaPivo);
    fio.rotation.x = 0.35 + Math.random() * 0.3;
  }

  // ---- braço da lança (lado direito da tela) ----
  const ombroD = [0.4, 1.56, 0];
  const cotoveloD = [0.5, 1.26, 0.06];
  const maoD = [0.52, 1.28, 0.3];
  // pivô no ombro (para os golpes)
  const bracoD = new THREE.Group();
  bracoD.position.set(...ombroD);
  guerreiro.add(bracoD);
  const bD = new THREE.Group();
  bD.position.set(-ombroD[0], -ombroD[1], -ombroD[2]);
  bracoD.add(bD);
  membro(ombroD, cotoveloD, 0.1, 0.085, pele, bD);
  membro(cotoveloD, maoD, 0.085, 0.07, pele, bD);
  add(new THREE.CylinderGeometry(0.09, 0.082, 0.13, 14, 1, true), bronze, 0.515, 1.275, 0.19, bD).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.075, 14, 10), pele, ...maoD, bD);
  // lança
  const lanca = new THREE.Group();
  lanca.position.set(0.52, 1.28, 0.3);
  lanca.rotation.z = -0.05;
  bD.add(lanca);
  add(new THREE.CylinderGeometry(0.022, 0.024, 3.0, 12), madeira, 0, 0.25, 0, lanca);
  const ponta = add(
    new THREE.LatheGeometry([[0, 0], [0.03, 0.02], [0.055, 0.12], [0.045, 0.22], [0.001, 0.36]].map(([r, y]) => new THREE.Vector2(r, y)), 24),
    aco,
    0,
    1.75,
    0,
    lanca
  );
  ponta.scale.z = 0.35;
  add(new THREE.CylinderGeometry(0.03, 0.026, 0.08, 12), bronze, 0, 1.73, 0, lanca);
  add(new THREE.ConeGeometry(0.03, 0.16, 10), bronze, 0, -1.33, 0, lanca).rotation.x = Math.PI;

  // ---- braço do escudo (lado esquerdo da tela) ----
  const ombroE = [-0.4, 1.56, 0];
  const cotoveloE = [-0.49, 1.27, 0.14];
  const maoE = [-0.42, 1.18, 0.36];
  const bracoE = new THREE.Group();
  bracoE.position.set(...ombroE);
  guerreiro.add(bracoE);
  const bE = new THREE.Group();
  bE.position.set(-ombroE[0], -ombroE[1], -ombroE[2]);
  bracoE.add(bE);
  membro(ombroE, cotoveloE, 0.1, 0.085, pele, bE);
  membro(cotoveloE, maoE, 0.085, 0.07, pele, bE);

  // escudo (aspis) com Λ
  const escudo = new THREE.Group();
  escudo.position.set(-0.46, 1.1, 0.44);
  escudo.rotation.y = 0.5;
  escudo.scale.setScalar(heroi ? 0.72 : 0.8);
  bE.add(escudo);
  const domo = add(
    new THREE.LatheGeometry([[0.001, 0.13], [0.2, 0.12], [0.4, 0.085], [0.55, 0.04], [0.63, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 64),
    bronze.clone(),
    0,
    0,
    0,
    escudo
  );
  domo.material.side = THREE.DoubleSide;
  domo.rotation.x = Math.PI / 2;
  const aro = add(new THREE.TorusGeometry(0.63, 0.04, 12, 64), bronzeEsc, 0, 0, 0, escudo);
  aro.scale.z = 0.6;
  const aro2 = add(new THREE.TorusGeometry(0.5, 0.012, 8, 64), bronzeEsc, 0, 0, 0.045, escudo);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    add(new THREE.SphereGeometry(0.016, 8, 6), bronze, Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0.02, escudo);
  }
  const L = new THREE.Shape();
  L.moveTo(-0.3, -0.3);
  L.lineTo(-0.2, -0.3);
  L.lineTo(0, 0.17);
  L.lineTo(0.2, -0.3);
  L.lineTo(0.3, -0.3);
  L.lineTo(0.045, 0.32);
  L.lineTo(-0.045, 0.32);
  L.lineTo(-0.3, -0.3);
  const lambdaGeo = new THREE.ExtrudeGeometry(L, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  // acompanha a curva do escudo
  const lp = lambdaGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i), r = Math.hypot(x, y);
    lp.setZ(i, lp.getZ(i) + 0.125 - r * r * 0.26);
  }
  lambdaGeo.computeVertexNormals();
  add(lambdaGeo, lambdaMat, 0, 0, -0.005, escudo);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 20), bronzeEsc, 0, 0, -0.03, escudo).rotation.x = Math.PI / 2;

  // ---- palco da arena ----
  const palco = add(new THREE.CylinderGeometry(1.15, 1.25, 0.14, 64), new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.9, metalness: 0.1 }), 0, -0.07, 0, cena);
  palco.receiveShadow = true;
  const anel = add(new THREE.TorusGeometry(1.15, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x7a0c04 }), 0, 0.001, 0, cena);
  anel.rotation.x = Math.PI / 2;
  const anel2 = add(new THREE.TorusGeometry(0.95, 0.006, 8, 96), new THREE.MeshBasicMaterial({ color: 0x3a0602 }), 0, 0.002, 0, cena);
  anel2.rotation.x = Math.PI / 2;

  sombras(guerreiro);

  // ---- aura de fogo atrás e fumaça ----
  const texAura = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(200,30,10,.8)");
    r.addColorStop(0.4, "rgba(110,8,4,.4)");
    r.addColorStop(1, "rgba(40,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAura, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  aura.position.set(0, 1.85, -0.9);
  aura.scale.set(3.2, 3.2, 1);
  cena.add(aura);
  // raios de luz girando atrás
  const raios = new THREE.Group();
  raios.position.set(0, 1.95, -1.1);
  cena.add(raios);
  for (let i = 0; i < 12; i++) {
    const g = new THREE.PlaneGeometry(0.12, 3.2);
    g.translate(0, 1.6, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x8a0a04, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.z = (i / 12) * Math.PI * 2;
    raios.add(m);
  }
  const texFumaca = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    for (let i = 0; i < 40; i++) {
      const x = 30 + Math.random() * 68, y = 30 + Math.random() * 68, rr = 10 + Math.random() * 30;
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      r.addColorStop(0, "rgba(40,30,28,.22)");
      r.addColorStop(1, "rgba(40,30,28,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(c);
  })();
  const fumacas = [];
  for (let i = 0; i < 18; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFumaca, transparent: true, depthWrite: false, opacity: 0.5 }));
    f.position.set((Math.random() - 0.5) * 3.6, i < 6 ? 0.05 + Math.random() * 0.4 : 0.3 + Math.random() * 2.2, i < 6 ? 0.4 + Math.random() * 0.8 : -1.6 + Math.random() * 0.9);
    const sc = 1.4 + Math.random() * 1.4;
    f.scale.set(sc, sc * 0.6, 1);
    f.userData.v = 0.001 + Math.random() * 0.002;
    cena.add(f);
    fumacas.push(f);
  }

  // ---- golpe de lança (sozinho de tempos em tempos e quando ganha XP) ----
  let tGolpe = -10, tRelampago = -10, proxRelampago = 3;
  const golpe = () => (tGolpe = relogio.getElapsedTime());
  window.addEventListener("inmovya-spartano-golpe", golpe);
  const suave = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // ---- brasas subindo ----
  const N = 140;
  const bp = new Float32Array(N * 3);
  const vel = new Float32Array(N);
  const reset = (i, alto) => {
    const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 1.4;
    bp[i * 3] = Math.cos(a) * r;
    bp[i * 3 + 1] = alto ? Math.random() * 3.4 : -0.1;
    bp[i * 3 + 2] = Math.sin(a) * r * 0.7;
    vel[i] = 0.004 + Math.random() * 0.01;
  };
  for (let i = 0; i < N; i++) reset(i, true);
  const brasasGeo = new THREE.BufferGeometry();
  brasasGeo.setAttribute("position", new THREE.BufferAttribute(bp, 3));
  const brasas = new THREE.Points(
    brasasGeo,
    new THREE.PointsMaterial({ size: 0.07, map: texturaBrasa(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  cena.add(brasas);

  // ---- interação: arrastar gira; parado, gira sozinho devagar ----
  let rotY = giroInicial, velRot = 0, arrastando = false, ultX = 0, ultInteracao = -1e9, mouseX = 0, mouseY = 0;
  const el = renderer.domElement;
  const down = (e) => {
    arrastando = true;
    ultX = e.clientX;
    el.style.cursor = "grabbing";
    el.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const r = el.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!arrastando) return;
    const dx = e.clientX - ultX;
    ultX = e.clientX;
    velRot = dx * 0.012;
    rotY += velRot;
    ultInteracao = performance.now();
  };
  const up = () => {
    arrastando = false;
    el.style.cursor = "grab";
    ultInteracao = performance.now();
  };
  const sair = () => ((mouseX = 0), (mouseY = 0));
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", sair);

  // tamanho
  const ajustar = () => {
    const w = container.clientWidth || 200, h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  ajustar();
  const ro = new ResizeObserver(ajustar);
  ro.observe(container);

  // só anima quando está na tela
  let visivel = true;
  const io = new IntersectionObserver((es) => (visivel = es[0]?.isIntersecting ?? true));
  io.observe(container);

  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const relogio = new THREE.Clock();
  let raf = 0;
  const quadro = () => {
    raf = requestAnimationFrame(quadro);
    if (!visivel || document.hidden) return;
    const t = relogio.getElapsedTime();
    if (!arrastando) {
      velRot *= 0.93;
      rotY += velRot;
      if (performance.now() - ultInteracao > 2500 && !reduzir) {
        if (heroi) rotY += (-0.25 + Math.sin(t * 0.35) * 0.45 - rotY) * 0.02; // encara você, virando de leve
        else if (autoGiro) rotY += 0.0045;
      }
    }
    guerreiro.rotation.y = rotY;
    // brado de guerra: ergue a lança bem alto, olha para cima, e crava no chão (tremor + faíscas)
    if (golpes && !reduzir && t - tGolpe > 11) tGolpe = t; // a cada ~11 s
    const g = t - tGolpe;
    const ergue = suave(0, 0.45, g) * (1 - suave(0.7, 0.8, g));
    const impacto = suave(0.7, 0.8, g) * (1 - suave(0.95, 1.8, g));
    bracoD.rotation.z = ergue * 1.65;
    bracoE.rotation.x = -impacto * 0.3 - ergue * 0.1;
    guerreiro.position.z = impacto * 0.1;
    tronco.rotation.x = impacto * 0.1 - ergue * 0.05;
    const tremor = g > 0.76 && g < 1.15 ? (1.15 - g) * 0.16 : 0;
    const flare = Math.max(ergue * 0.5, impacto);
    // respiração e postura
    const resp = Math.sin(t * 1.6);
    tronco.scale.set(1 + resp * 0.006, 1 + resp * 0.004, 1 + resp * 0.01);
    cabeca.rotation.x = 0.16 + Math.sin(t * 0.8) * 0.025 + mouseY * 0.06 - ergue * 0.4;
    cabeca.rotation.y = mouseX * 0.25;
    cristaPivo.rotation.x = Math.sin(t * 2.2) * 0.04;
    escudo.position.y = 1.1 + Math.sin(t * 1.6 + 0.5) * 0.01;
    lanca.rotation.z = -0.05 + Math.sin(t * 1.1) * 0.012 - ergue * 1.65;
    // desliza a lança para cima pela mão, na vertical do mundo (o braço está girado)
    const th = ergue * 1.65, sobe = ergue * 0.45;
    lanca.position.x = 0.52 + Math.sin(th) * sobe;
    lanca.position.y = 1.28 + Math.cos(th) * sobe;
    if (!reduzir) ondularCapa(t);
    // olhos de brasa
    const brilho = 0.75 + Math.sin(t * 3.2) * 0.25 + flare * 0.8;
    olhoMat.color.setRGB(1, 0.08 + brilho * 0.18, 0.02);
    luzOlhos.intensity = 0.3 + brilho * 0.5;
    olhos.forEach((o) => o.scale.setScalar(0.8 + brilho * 0.5));
    halos.forEach((h) => (h.material.opacity = 0.55 + brilho * 0.45));
    tocha.intensity = 3.2 + Math.sin(t * 7) * 0.6 + Math.sin(t * 19) * 0.4 + flare * 6;
    aura.material.opacity = 0.35 + Math.sin(t * 1.3) * 0.1 + flare * 0.4;
    aura.scale.setScalar(3.2 + Math.sin(t * 1.3) * 0.15 + flare * 0.8);
    raios.rotation.z = t * 0.05;
    if (!reduzir && t > proxRelampago) {
      tRelampago = t;
      proxRelampago = t + 6 + Math.random() * 7;
    }
    const r1 = t - tRelampago;
    relampago.intensity = r1 < 0.07 ? 7 : r1 > 0.13 && r1 < 0.2 ? 4.5 : r1 > 0.2 && r1 < 0.5 ? (0.5 - r1) * 6 : 0;
    fumacas.forEach((f, i) => {
      f.position.x += f.userData.v;
      if (f.position.x > 1.8) f.position.x = -1.8;
      f.material.rotation = t * 0.05 * (i % 2 ? 1 : -1);
    });
    // brasas
    for (let i = 0; i < N; i++) {
      bp[i * 3 + 1] += vel[i] * (1 + flare * 4);
      bp[i * 3] += Math.sin(t * 2 + i) * 0.0015;
      if (bp[i * 3 + 1] > 3.4) reset(i, false);
    }
    brasasGeo.attributes.position.needsUpdate = true;
    // câmera acompanha um pouco o mouse
    camera.position.x += (camBase.x + mouseX * 0.5 - camera.position.x) * 0.05;
    camera.position.y += (camBase.y - mouseY * 0.3 - camera.position.y) * 0.05;
    camera.position.z = camBase.z - (heroi ? Math.sin(t * 0.25) * 0.15 : 0);
    camera.lookAt(alvo);
    if (tremor) {
      camera.position.x += (Math.random() - 0.5) * tremor;
      camera.position.y += (Math.random() - 0.5) * tremor;
    }
    renderer.render(cena, camera);
  };
  quadro();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("inmovya-spartano-golpe", golpe);
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

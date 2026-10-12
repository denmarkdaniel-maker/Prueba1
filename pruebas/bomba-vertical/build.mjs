// Bomba vertical centrífuga con simulación en vivo.
// Uso: node build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = join(HERE, theme === "light" ? "bomba-vertical-light.html" : "bomba-vertical.html");

// ---------------------------------------------------------------- modelo (usado en el build y en vivo)
// Bomba: H = H0·n² − k·Q²  (n = velocidad relativa, Q en m³/h, H en m)
// Instalación: H = Hs + c·Q²/v²  (v = apertura de válvula, 0..1)
const MODEL = { H0: 30, Hs: 5, k: 30 / 14400, c: 0.003018, RPM: 1450, QBEP: 70 };

// ---------------------------------------------------------------- geometría
const WIDTH = 600;
const HEIGHT = 470;

const PLATE = { x: -84, y: -60, w: 168, d: 120, r: 8 };
const PLATE_H = 10;
const GROUND = -6;

const BOWL_R = 34;
const BOWL_Z = PLATE_H;
const BOWL_TOP = 52;
const IMP_R = 21;
const IMP_TOP = BOWL_TOP + 4;
const HUB_TOP = IMP_TOP + 6;
const VANE_Z = IMP_TOP + 0.2;

const HOUSING_R = 9;
const STAND_Z = 144;
const MOTOR_Z = 152;
const MOTOR_TOP = 190;
const MOTOR_R = 22;

const RISER = { x: 30, y: 0, r: 7 };
const VALVE_Z = 104;
const VALVE_H = 14;
const STEM_TOP = 134;
const WHEEL_R = 14;
const WHEEL_Z = STEM_TOP;
const WHEEL_TOP = WHEEL_Z + 4;

const GAUGE = { x: -18, y: -20, r: 10, z: 92 };
const GAUGE_TOP = GAUGE.z + 6;
const NEEDLE_Z = GAUGE_TOP + 0.2;

const KNOB = { x: 0, y: -27, r: 4 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, GROUND, 0),
    [0, 0, MOTOR_TOP + 4],
    [RISER.x + RISER.r, 0, WHEEL_TOP],
    [GAUGE.x - GAUGE.r, GAUGE.y - GAUGE.r, GAUGE_TOP],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 42 },
);

// Funciones que se copian tal cual al navegador: usan solo `onTop` y argumentos.
function vanePath(i, rot, projection) {
  const points = [];
  for (let s = 0; s <= 5; s++) {
    const t = s / 5;
    const r = 7 + t * 14;
    const a = rot + (i * Math.PI) / 3 + 0.9 * t;
    points.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return onTop(points, 56.2, projection);
}
function spokePath(a, projection) {
  return onTop(
    [
      [RISER.x, RISER.y],
      [RISER.x + (WHEEL_R - 1.8) * Math.cos(a), RISER.y + (WHEEL_R - 1.8) * Math.sin(a)],
    ],
    WHEEL_TOP + 0.2,
    projection,
  );
}
function needlePath(turn, projection) {
  const a = turn * Math.PI * 2;
  const { x, y } = GAUGE;
  return lineOnTop(
    [x - Math.sin(a) * 2.6, y + Math.cos(a) * 2.6],
    [x + Math.sin(a) * (GAUGE.r - 3), y - Math.cos(a) * (GAUGE.r - 3)],
    NEEDLE_Z,
    projection,
  );
}
function knobPath(turn, projection) {
  const a = turn * Math.PI * 2;
  const { x, y, r } = KNOB;
  return lineOnTop(
    [x, y],
    [x + Math.sin(a) * (r - 1), y - Math.cos(a) * (r - 1)],
    180 + 6.2,
    projection,
  );
}
const onTop = k.onTop;
const lineOnTop = k.lineOnTop;

// ---------------------------------------------------------------- partes estáticas
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const at = (point) => k.iso(point, P);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const ringDots = (cx, cy, radius, z, count) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return at([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, z]);
  });

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, GROUND, PLATE_H - GROUND, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 10))) {
    out.push(S(k.cylinder(x, y, 6, GROUND, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.4, GROUND + 2, 4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, 0, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), PLATE_H, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, PLATE_H, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, PLATE_H])), { size: 0.5 }));
  const strip = { x: -76, y: PLATE.y + PLATE.d - 15, w: 152, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, PLATE_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, PLATE_H + 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function pump() {
  const out = [];
  // Carcasa (voluta) con brida
  out.push(S(k.cylinder(0, 0, 40, BOWL_Z, 6, P, 48, 1), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, BOWL_R, BOWL_Z + 6, BOWL_TOP - BOWL_Z - 6, P, 48, 1.2), { tone: "mid", crease: "lo" }));
  out.push(D(ringDots(0, 0, 37, BOWL_Z + 6, 12), { size: 0.5 }));
  out.push(L(k.ring(0, 0, 30, BOWL_TOP + 0.2, P, 48), { tone: "lo" }));
  out.push(L(k.ring(0, 0, BOWL_R - 1.2, BOWL_TOP + 0.2, P, 48), { tone: "faint" }));
  // Impulsor abierto (tapa retirada)
  out.push(S(k.cylinder(0, 0, IMP_R, BOWL_TOP, IMP_TOP - BOWL_TOP, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(0, 0, 7, IMP_TOP, HUB_TOP - IMP_TOP, P, 32, 0.6), { tone: "hi" }));
  out.push(L(k.ring(0, 0, 3.4, HUB_TOP, P, 20), { tone: "lo" }));
  // Carcasa del eje
  out.push(S(k.cylinder(0, 0, HOUSING_R, HUB_TOP, STAND_Z - HUB_TOP, P, 40, 0.5), { tone: "mid", crease: "none" }));
  // Soporte del motor
  out.push(S(k.cylinder(0, 0, 26, STAND_Z, MOTOR_Z - STAND_Z, P, 48, 1), { tone: "mid" }));
  out.push(D(ringDots(0, 0, 22.5, MOTOR_Z, 8), { size: 0.5 }));
  // Motor
  out.push(S(k.cylinder(0, 0, MOTOR_R, MOTOR_Z, MOTOR_TOP - MOTOR_Z, P, 48, 1), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(0, 0, MOTOR_R, MOTOR_Z, MOTOR_TOP, 36, P, 0.5), { tone: "lo" }));
  out.push(S(k.cylinder(0, 0, MOTOR_R - 1, MOTOR_TOP, 3, P, 48, 0.8), { tone: "mid" }));
  out.push(L(k.ring(0, 0, 8, MOTOR_TOP + 3, P, 24), { tone: "lo" }));
  // Caja de bornes y perilla de velocidad
  const box = { x: -9, y: -33, w: 18, d: 13, r: 2 };
  out.push(S(k.slabOf(box, 160, 20, P, 4, 0.8), { tone: "mid" }));
  out.push(D([at([-5, -29, 160]), at([5, -29, 160]), at([-5, -24, 160]), at([5, -24, 160])], { size: 0.45 }));
  out.push(S(k.cylinder(KNOB.x, KNOB.y, KNOB.r, 180, 6, P, 28, 0.6), { tone: "mid" }));
  out.push(L(k.knurl(KNOB.x, KNOB.y, KNOB.r, 180, 186, 22, P, 0.3), { tone: "lo" }));
  // Tubo de descarga y válvula
  out.push(S(k.cylinder(RISER.x, RISER.y, RISER.r, IMP_TOP, VALVE_Z - IMP_TOP, P, 40, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(RISER.x, RISER.y, 9.2, VALVE_Z, VALVE_H, P, 40, 1.4), { tone: "mid" }));
  out.push(L(k.sideArc(RISER.x, RISER.y, 9.2, VALVE_Z + VALVE_H / 2, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(RISER.x, RISER.y, 2.6, VALVE_Z + VALVE_H, STEM_TOP - VALVE_Z - VALVE_H, P, 20), { tone: "hi" }));
  out.push(S(k.cylinder(RISER.x, RISER.y, WHEEL_R, WHEEL_Z, WHEEL_TOP - WHEEL_Z, P, 56, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(RISER.x, RISER.y, WHEEL_R - 1.8, WHEEL_TOP, P, 56), { tone: "lo" }));
  out.push(D([at([RISER.x, RISER.y, WHEEL_TOP])], { size: 0.6, tone: "mid" }));
  // Manómetro sobre su tubo de toma
  out.push(S(k.cylinder(GAUGE.x, GAUGE.y, 2.4, BOWL_TOP, GAUGE.z - BOWL_TOP, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(GAUGE.x, GAUGE.y, GAUGE.r, GAUGE.z, GAUGE_TOP - GAUGE.z, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(GAUGE.x, GAUGE.y, GAUGE.r - 2, GAUGE_TOP, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(GAUGE.x, GAUGE.y, GAUGE.r - 2.6, 40, 5, GAUGE_TOP, [1, 2.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([GAUGE.x, GAUGE.y, GAUGE_TOP])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

// Partes que se mueven en vivo: se dibujan una vez en reposo y el script reescribe su trazo.
function moving(t0) {
  const out = [];
  for (let i = 0; i < 6; i++) out.push(`<path data-vane="${i}" class="iso-line" data-tone="lit" d="${vanePath(i, t0, P)}"/>`);
  for (let i = 0; i < 3; i++) out.push(`<path data-spoke="${i}" class="iso-line" data-tone="lo" d="${spokePath((i * 2 * Math.PI) / 3, P)}"/>`);
  out.push(`<path data-knob-mark class="iso-line" data-tone="lo" d="${knobPath(0, P)}"/>`);
  out.push(`<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needlePath(0, P)}" style="stroke-width:1.1"/>`);
  out.push(`<path data-flow-line class="iso-line" data-tone="hi" d="${k.rise([RISER.x - 4, -5.74], IMP_TOP + 2, VALVE_Z - 4, P)}"/>`);
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Vertical centrifugal pump. A motor on top turns a shaft inside a column; an open impeller in the volute casing throws the water outward, and it rises through the discharge pipe. A gate valve on the pipe sets the flow and a pressure gauge reads the head.",
  body: [base(), pump(), moving(0)],
});

// ---------------------------------------------------------------- script en vivo
const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const RISER = ${JSON.stringify(RISER)};
const WHEEL_TOP = ${WHEEL_TOP};
const WHEEL_R = ${WHEEL_R};
const GAUGE = ${JSON.stringify(GAUGE)};
const NEEDLE_Z = ${NEEDLE_Z};
const KNOB = ${JSON.stringify(KNOB)};
const stage = document.querySelector(".iso-stage");
const svgEl = stage.querySelector("svg");
const vanes = [...svgEl.querySelectorAll("[data-vane]")];
const spokes = [...svgEl.querySelectorAll("[data-spoke]")];
const knobMark = svgEl.querySelector("[data-knob-mark]");
const needle = svgEl.querySelector("[data-needle]");
const flowLine = svgEl.querySelector("[data-flow-line]");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
${vanePath.toString()}
${spokePath.toString()}
${needlePath.toString()}
${knobPath.toString()}

// Modelo: punto de operación entre la bomba y la instalación
function solve(v, n) {
  const head = M.H0 * n * n - M.Hs;
  const vv = Math.max(v, 0.02);
  const Q = head > 0 ? Math.sqrt(head / (M.k + M.c / (vv * vv))) : 0;
  const H = M.H0 * n * n - M.k * Q * Q;
  const bep = M.QBEP * n;
  const eta = Math.max(0.12, 0.78 * (1 - 0.9 * ((Q - bep) / bep) ** 2));
  const hydraulic = (9.81 * Q * H) / 3600;
  return { Q, H, eta, shaft: hydraulic / eta, bar: H * 0.0981, rpm: M.RPM * n };
}

let v = 0.6, n = 1, vT = 0.6, nT = 1, theta = 0, clock = 0, touring = !still.matches, idle = 0, last = 0, frame = 0, visible = false;

function draw() {
  const s = solve(v, n);
  vanes.forEach((el, i) => el.setAttribute("d", vanePath(i, theta, P)));
  const wheel = -v * Math.PI * 6;
  spokes.forEach((el, i) => el.setAttribute("d", spokePath(wheel + (i * 2 * Math.PI) / 3, P)));
  knobMark.setAttribute("d", knobPath((n - 0.6) / 0.4 * 0.75, P));
  needle.setAttribute("d", needlePath(clamp(s.bar / 4, 0, 1), P));
  if (s.Q > 1) flowLine.setAttribute("data-flow", ""); else flowLine.removeAttribute("data-flow");
  const text = s.Q.toFixed(0) + " m³/h · " + s.H.toFixed(1) + " m · " + s.rpm.toFixed(0) + " rpm";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", s.Q.toFixed(0));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; vT = 0.12 + 0.82 * (0.5 + 0.5 * Math.sin(clock * 0.5)); nT = 1; }
  const a = calm ? 1 : 1 - Math.exp(-dt / 0.35);
  v += (vT - v) * a;
  n += (nT - n) * a;
  if (!calm) theta += dt * n * 2.4;
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (apply) => {
  touring = false;
  apply();
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svgEl.getBoundingClientRect();
  const share = clamp((event.clientX - box.left) / box.width, 0, 1);
  steer(() => { vT = 0.05 + share * 0.95; });
});
stage.addEventListener("pointerleave", () => steer(() => { vT = v; }));
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: [0.1, 0], ArrowLeft: [-0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] };
  const step = keys[event.key];
  if (!step) return;
  event.preventDefault();
  steer(() => { vT = clamp(vT + step[0], 0.05, 1); nT = clamp(nT + step[1], 0.6, 1); });
});
draw();
`;

// ---------------------------------------------------------------- página
const body = k.plateHtml({
  fig: "Fig 1",
  title: "Bomba vertical centrífuga",
  hint: "Cursor · ← → válvula · ↑ ↓ velocidad",
  readout: "",
  keys: [
    { mark: "lit", label: "Impulsor: sus paletas giran y lanzan el agua hacia afuera" },
    { mark: "raised", label: "Válvula de descarga: su volante regula el caudal; el manómetro lee la presión" },
  ],
  caption:
    "Simulación de una bomba vertical. Al abrir la válvula sube el caudal y baja la altura de descarga, en el punto donde la bomba y la instalación se igualan. Al subir la velocidad, el impulsor gira más rápido y la bomba entrega más altura y más caudal. La potencia sale de la altura y el caudal dividida por la eficiencia.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Bomba vertical: flechas izquierda y derecha para la válvula, arriba y abajo para la velocidad" aria-valuemin="0" aria-valuemax="200" aria-valuenow="0">${svg}</div>`,
});

writeFileSync(OUT, k.pageHtml({ title: "Bomba vertical", theme, body, script: kitScript() + live }));
console.log("escrito", OUT);

/*!
 * KB3D - procedural 3D kettlebell exercise viewer.
 * Plain browser script. Requires the THREE (r128) UMD global loaded before it.
 * No external assets: mannequin, kettlebell, floor and shadows are all procedural.
 *
 *   KB3D.ANIMS                       -> the 32 animation keys (see ANIMS.md)
 *   KB3D.create(container, opts)     -> viewer {play,setSpeed,pause,resume,isPaused,setColors,resetView,dispose}
 *   KB3D.thumbnail(key, opts)        -> Promise<dataURL|null>
 *
 * Coordinate conventions (figure "root" space): +Y up, figure faces +Z, figure's LEFT is +X
 * (so the right hand lives at -X). Units are metres; the mannequin is ~1.76 m tall.
 */
(function () {
  'use strict';

  var ANIMS = ['swing_2h', 'swing_1h', 'swing_alt', 'swing_american', 'deadlift', 'sl_deadlift',
    'suitcase_deadlift', 'goblet_squat', 'front_squat', 'sumo_high_pull', 'clean', 'press', 'push_press',
    'jerk', 'snatch', 'bent_row', 'renegade_row', 'halo', 'around_world', 'figure8', 'windmill', 'tgu',
    'reverse_lunge', 'lateral_lunge', 'russian_twist', 'floor_press', 'pullover', 'farmer_carry',
    'overhead_carry', 'thruster', 'glute_bridge', 'situp'];

  var DEF_COLORS = { figure: '#dfe3e9', figureAccent: '#ff6a2b', bell: '#2b3038', floor: '#e6e9ee', bg: null };
  var FALLBACK_TEXT = 'Vista 3D no disponible en este dispositivo (WebGL desactivado).';

  function noop() {}
  function mergeColors(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    if (over) for (k in over) if (over[k] !== undefined) o[k] = over[k];
    return o;
  }

  var webglOK = null;
  function hasWebGL() {
    if (webglOK !== null) return webglOK;
    webglOK = false;
    try {
      if (typeof THREE === 'undefined' || !window.WebGLRenderingContext) return webglOK;
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      webglOK = !!gl;
      var lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) { webglOK = false; }
    return webglOK;
  }

  function fallbackViewer(container) {
    var d = document.createElement('div');
    d.className = 'kb3d-fallback';
    d.textContent = FALLBACK_TEXT;
    d.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;' +
      'justify-content:center;text-align:center;padding:16px;font:14px/1.4 system-ui,sans-serif;opacity:.7;';
    try {
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
      container.appendChild(d);
    } catch (e) { /* ignore */ }
    var paused = true;
    return {
      play: noop, setSpeed: noop, pause: noop, resume: noop,
      isPaused: function () { return paused; },
      setColors: noop, resetView: noop,
      dispose: function () { if (d.parentNode) d.parentNode.removeChild(d); }
    };
  }

  if (typeof THREE === 'undefined') {
    window.KB3D = {
      ANIMS: ANIMS.slice(),
      create: function (container) { return fallbackViewer(container); },
      thumbnail: function () { return Promise.resolve(null); }
    };
    return;
  }

  /* ======================================================================
   * Math helpers / scratch objects
   * ==================================================================== */
  var V3 = THREE.Vector3, Qt = THREE.Quaternion;
  var D2R = Math.PI / 180;
  var UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);
  var _m4 = new THREE.Matrix4(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  var _d = new V3(), _x = new V3(), _y = new V3(), _z = new V3();
  var _a = new V3(), _b = new V3(), _c = new V3(), _t = new V3(), _p = new V3(), _s = new V3();
  var _mid = new V3(), _end = new V3(), _pn = new V3(), _dir = new V3(), _tmp = new V3();
  var _q1 = new Qt(), _q2 = new Qt(), _qf = new Qt(), _rq = new Qt(), _pq = new Qt(), _cq = new Qt();

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }

  // Rest lengths of the mannequin (metres)
  var L_THIGH = 0.44, L_SHIN = 0.43, L_UA = 0.29, L_FA = 0.26, GRIP = 0.07;
  var SHO = [0.18, 0.15, -0.01];  // shoulder joint in chest space (left side; mirror x for right)
  var HIP = [0.095, -0.06, 0];    // hip joint in pelvis space

  // Analytic two-bone IK. a = root joint, t = target, pole = bend direction hint (world).
  // Writes mid (middle joint), end (reached end point) and pn (unit bend direction).
  function ik2(a, t, l1, l2, pole, mid, end, pn) {
    _d.subVectors(t, a);
    var dist = _d.length();
    if (dist < 1e-6) { _d.set(0, -1, 0); dist = 1e-6; } else _d.divideScalar(dist);
    dist = clamp(dist, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4);
    end.copy(a).addScaledVector(_d, dist);
    pn.copy(pole).addScaledVector(_d, -pole.dot(_d));
    if (pn.lengthSq() < 1e-8) {
      pn.set(0, 0, 1).addScaledVector(_d, -_d.z);
      if (pn.lengthSq() < 1e-8) pn.set(1, 0, 0).addScaledVector(_d, -_d.x);
    }
    pn.normalize();
    var x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    var h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    mid.copy(a).addScaledVector(_d, x).addScaledVector(pn, h);
  }

  // World rotation for a bone whose mesh hangs along local -Y, pointing along `dir`,
  // with local +Z turned toward `zh`.
  function boneQ(dir, zh, out) {
    _y.copy(dir).negate();
    _z.copy(zh).addScaledVector(_y, -zh.dot(_y));
    if (_z.lengthSq() < 1e-8) { _z.set(0, 0, 1).addScaledVector(_y, -_y.z); if (_z.lengthSq() < 1e-8) _z.set(1, 0, 0); }
    _z.normalize();
    _x.crossVectors(_y, _z);
    _m4.makeBasis(_x, _y, _z);
    return out.setFromRotationMatrix(_m4);
  }

  /* ======================================================================
   * Pose channels + keyframe interpolation (monotone cubic, looping)
   * ==================================================================== */
  var CH = [['P', 3], ['R', 3], ['S', 3], ['C', 3], ['N', 3],
    ['FL', 3], ['FR', 3], ['FLr', 3], ['FRr', 3], ['KL', 3], ['KR', 3],
    ['HL', 3], ['HR', 3], ['EL', 3], ['ER', 3],
    ['B', 3], ['BD', 3], ['BA', 1], ['BG', 1], ['BOV', 1], ['BVR', 1], ['WL', 1], ['WR', 1], ['HA', 1], ['HN', 1],
    ['B2', 3], ['BD2', 3], ['BA2', 1], ['BG2', 1], ['BOV2', 1], ['BVR2', 1], ['WL2', 1], ['WR2', 1], ['HA2', 1], ['HN2', 1]];
  var BELL_CH = [['B', 'BD', 'BA', 'BG', 'BOV', 'BVR', 'WL', 'WR', 'HA', 'HN'],
    ['B2', 'BD2', 'BA2', 'BG2', 'BOV2', 'BVR2', 'WL2', 'WR2', 'HA2', 'HN2']];
  var BASE = {
    P: [0, 1.0, 0], R: [0, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [0, 0, 0],
    FL: [0.11, 0.075, 0], FR: [-0.11, 0.075, 0], FLr: [0, 8, 0], FRr: [0, -8, 0], KL: [0, 0, 1], KR: [0, 0, 1],
    HL: [0.21, -0.44, 0.04], HR: [-0.21, -0.44, 0.04], EL: [0.3, -0.2, -1], ER: [-0.3, -0.2, -1],
    B: [-0.22, -0.45, 0.05], BD: [0, -1, 0], BA: [0], BG: [1], BOV: [0], BVR: [0.613], WL: [0], WR: [1], HA: [0], HN: [0],
    B2: [0.22, -0.45, 0.05], BD2: [0, -1, 0], BA2: [0], BG2: [1], BOV2: [0], BVR2: [0.613], WL2: [1], WR2: [0], HA2: [0], HN2: [0]
  };

  function newPose() {
    var p = {};
    for (var i = 0; i < CH.length; i++) p[CH[i][0]] = BASE[CH[i][0]].slice();
    return p;
  }
  function copyPose(src, dst) {
    for (var i = 0; i < CH.length; i++) {
      var n = CH[i][0], a = src[n], b = dst[n];
      for (var j = 0; j < a.length; j++) b[j] = a[j];
    }
    return dst;
  }

  function prepare(def) {
    var keys = def.keys.slice().sort(function (a, b) { return a.t - b.t; });
    var explicitEnd = keys.length > 1 && keys[keys.length - 1].t >= 1;
    var endKey = explicitEnd ? keys.pop() : null;
    var n = keys.length, T = [], i;
    for (i = 0; i < n; i++) T.push(keys[i].t);
    T.push(1);
    var tracks = {};
    CH.forEach(function (c) {
      var name = c[0], size = c[1], prev = BASE[name], vals = [];
      for (i = 0; i < n; i++) {
        var v = keys[i][name];
        if (v === undefined) v = prev; else if (typeof v === 'number') v = [v];
        vals.push(v.slice(0, size)); prev = v;
      }
      if (endKey && endKey[name] !== undefined) {
        var ev = endKey[name]; vals.push((typeof ev === 'number' ? [ev] : ev).slice(0, size));
      } else if (endKey) vals.push(prev.slice(0, size));
      else vals.push(vals[0].slice());
      // monotone (Fritsch-Butland) tangents with cyclic neighbours
      var m = [];
      for (i = 0; i <= n; i++) m.push(new Array(size));
      var constant = true;
      for (var k = 0; k < size; k++) {
        var off = vals[n][k] - vals[0][k];
        for (i = 0; i < n; i++) {
          var vi = vals[i][k];
          var vp = i === 0 ? vals[n - 1][k] - off : vals[i - 1][k];
          var tp = i === 0 ? T[n - 1] - 1 : T[i - 1];
          var vn = vals[i + 1][k], tn = T[i + 1];
          var dp = (vi - vp) / Math.max(1e-6, T[i] - tp), dn = (vn - vi) / Math.max(1e-6, tn - T[i]);
          m[i][k] = (dp * dn <= 0) ? 0 : 2 * dp * dn / (dp + dn);
          if (vi !== vals[0][k]) constant = false;
        }
        m[n][k] = m[0][k];
        if (vals[n][k] !== vals[0][k]) constant = false;
      }
      tracks[name] = { v: vals, m: m, size: size, constant: constant };
    });
    return { T: T, n: n, tracks: tracks };
  }

  function sampleTracks(prep, u, out) {
    var T = prep.T, n = prep.n, i = 0;
    while (i < n - 1 && u >= T[i + 1]) i++;
    if (u < T[0]) i = 0;
    var h = T[i + 1] - T[i], s = h > 0 ? clamp01((u - T[i]) / h) : 0;
    var s2 = s * s, s3 = s2 * s;
    var h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    for (var c = 0; c < CH.length; c++) {
      var name = CH[c][0], tr = prep.tracks[name], o = out[name];
      if (tr.constant) { for (var k0 = 0; k0 < tr.size; k0++) o[k0] = tr.v[0][k0]; continue; }
      var a = tr.v[i], b = tr.v[i + 1], ma = tr.m[i], mb = tr.m[i + 1];
      for (var k = 0; k < tr.size; k++) o[k] = h00 * a[k] + h10 * h * ma[k] + h01 * b[k] + h11 * h * mb[k];
    }
    return out;
  }

  function evalAnim(def, u, out) {
    u = u - Math.floor(u);
    sampleTracks(def.prep, u, out);
    if (def.proc) def.proc(u, out);
    return out;
  }

  // mirror a 1-hand pose into a symmetric 2-bell ("double") pose
  function mx(a, o) { o[0] = -a[0]; o[1] = a[1]; o[2] = a[2]; return o; }
  function mirrorPose(p, out, wide, over) {
    copyPose(p, out);
    out.P[0] = 0;
    out.R[1] = out.R[2] = out.S[1] = out.S[2] = out.C[1] = out.C[2] = out.N[1] = out.N[2] = 0;
    mx(p.HR, out.HL); mx(p.ER, out.EL);
    if (out.B[0] > -0.11) out.B[0] = -0.11;   // keep the two bells apart near the midline
    if (wide) { out.FL[0] = Math.max(out.FL[0], 0.31); out.FR[0] = Math.min(out.FR[0], -0.31); }
    if (over) for (var k in over) { var a = over[k], b = out[k]; for (var j = 0; j < a.length; j++) b[j] = a[j]; }
    mx(out.B, out.B2); mx(p.BD, out.BD2);
    out.BA2[0] = p.BA[0]; out.BG2[0] = p.BG[0]; out.BOV2[0] = p.BOV[0]; out.BVR2[0] = p.BVR[0];
    out.WL2[0] = p.WR[0]; out.WR2[0] = p.WL[0]; out.HA2[0] = -p.HA[0]; out.HN2[0] = p.HN[0];
    return out;
  }

  /* ======================================================================
   * Animation library (keyframes)
   * Channels: P pelvis pos, R pelvis rot (deg, YXZ), S spine, C chest, N neck+head,
   *   FL/FR ankle targets (root space), FLr/FRr foot [pitch,yaw,roll], KL/KR knee pole (rotated by foot yaw),
   *   HL/HR free-hand targets (def.hframe space), EL/ER elbow poles (chest space),
   *   B bell grip point (def.bframe space), BD bell "down" (grip->body) dir, BG gravity weight,
   *   BA weight of "extension of the forearm" direction, BOV weight of "straight arm vertical from the
   *   shoulder" with signed reach BVR, WL/WR attachment of left/right hand, HA handle axis yaw, HN horns grip.
   *   Same set suffixed 2 for the second bell.
   * ==================================================================== */
  function ext() {
    var o = {};
    for (var i = 0; i < arguments.length; i++) { var a = arguments[i]; for (var k in a) o[k] = a[k]; }
    return o;
  }
  function K(t) { var o = ext.apply(null, Array.prototype.slice.call(arguments, 1)); o.t = t; return o; }
  // straight-arm grip point on an arc around the shoulder line, chest space. a=0 hanging along the torso, 90 forward.
  function arc(a, x, r) { r = r || 0.6; a *= D2R; return [x || 0, SHO[1] - r * Math.cos(a), SHO[2] + r * Math.sin(a)]; }
  // sagittal arc for lying moves (a=0 -> arms toward chest front)
  function arcUp(a, x, r) { r = r || 0.6; a *= D2R; return [x || 0, SHO[1] + r * Math.sin(a), SHO[2] + r * Math.cos(a)]; }

  var RACK = [-0.07, 0.12, 0.17], RACK_BD = [-0.7, -0.45, -0.38], RACK_E = [-0.2, -1, 0.35];
  var OVER = [-0.17, 0.75, 0.0], OVER_BD = [-0.15, -0.42, -0.9], OVER_E = [-1, -0.1, -0.35];
  var MIDP = [-0.36, 0.3, 0.12], MIDP_BD = [-0.6, -0.45, -0.65], MIDP_E = [-0.6, -1, 0.3];
  var FREE_OUT = [0.31, -0.36, 0.08];
  var GOB = [0, 0.1, 0.2], GOB_BD = [0, -1, 0.06], GOB_EL = [0.35, -1, 0.15], GOB_ER = [-0.35, -1, 0.15];
  var EL2 = [0.6, -0.3, -1], ER2 = [-0.6, -0.3, -1];

  var FEET_SW = { FL: [0.19, 0.075, 0.02], FR: [-0.19, 0.075, 0.02], FLr: [0, 14, 0], FRr: [0, -14, 0] };
  var FEET_HIP = { FL: [0.13, 0.075, 0.02], FR: [-0.13, 0.075, 0.02], FLr: [0, 10, 0], FRr: [0, -10, 0] };
  var FEET_SQ = { FL: [0.23, 0.075, 0.02], FR: [-0.23, 0.075, 0.02], FLr: [0, 24, 0], FRr: [0, -24, 0], KL: [0.12, 0, 1], KR: [-0.12, 0, 1] };
  var LIE = { P: [0, 0.12, 0], R: [-90, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [0, 0, 0],
    FL: [0.15, 0.075, 0.43], FR: [-0.15, 0.075, 0.43], FLr: [0, 6, 0], FRr: [0, -6, 0], KL: [0.15, 1, 0.2], KR: [-0.15, 1, 0.2] };

  var HINGE = { P: [0, 0.9, -0.16], R: [58, 0, 0], S: [4, 0, 0], C: [0, 0, 0], N: [-30, 0, 0] };
  var SNAP = { P: [0, 0.98, -0.05], R: [18, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [-10, 0, 0] };
  var TALL = { P: [0, 1.0, 0], R: [-3, 0, 0], S: [0, 0, 0], C: [-2, 0, 0], N: [0, 0, 0] };
  var CATCH = { P: [0, 0.96, -0.08], R: [26, 0, 0], S: [2, 0, 0], C: [0, 0, 0], N: [-15, 0, 0] };
  var STAND = { P: [0, 1.0, 0], R: [0, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [0, 0, 0] };

  var DEFS = {};
  function def(key, cfg, keys) {
    cfg.keys = keys; cfg.key = key;
    cfg.bframe = cfg.bframe || 'chest'; cfg.b2frame = cfg.b2frame || cfg.bframe; cfg.hframe = cfg.hframe || 'chest';
    if (cfg.az === undefined) cfg.az = -35;
    if (cfg.el === undefined) cfg.el = 10;
    if (cfg.thumb === undefined) cfg.thumb = 0.3;
    cfg.prep = prepare(cfg);
    DEFS[key] = cfg;
  }

  // ---- swings -------------------------------------------------------
  def('swing_2h', { dur: 2.0, az: -62, thumb: 0.36, dbl: false }, [
    K(0, HINGE, FEET_SW, { B: arc(8, 0, 0.585), BA: 1, BG: 0, WL: 1, WR: 1, EL: EL2, ER: ER2 }),
    K(0.17, SNAP, { B: arc(46, 0, 0.585) }),
    K(0.36, TALL, { B: arc(92, 0, 0.585) }),
    K(0.55, TALL, { R: [-1, 0, 0], B: arc(55, 0, 0.585) }),
    K(0.74, CATCH, { B: arc(18, 0, 0.585) })
  ]);
  def('swing_1h', { dur: 2.0, az: -55, thumb: 0.36, dblWide: true }, [
    K(0, HINGE, FEET_SW, { B: arc(8, -0.05), BA: 1, BG: 0, WR: 1, WL: 0, HL: arc(4, 0.24, 0.55), ER: ER2, EL: EL2 }),
    K(0.17, SNAP, { B: arc(46, -0.08), HL: arc(30, 0.26, 0.55) }),
    K(0.36, TALL, { B: arc(92, -0.1), HL: [0.3, -0.3, 0.12], C: [-2, -6, 0] }),
    K(0.55, TALL, { R: [-1, 0, 0], B: arc(55, -0.08), HL: arc(30, 0.26, 0.55), C: [-2, 0, 0] }),
    K(0.74, CATCH, { B: arc(18, -0.06), HL: arc(10, 0.25, 0.55) })
  ]);
  (function () {
    var kk = [], half;
    for (half = 0; half < 2; half++) {
      var o = half * 0.5, sg = half ? 1 : -1;  // sg: side of the working hand (-1 right, +1 left)
      var w = function (r, l) { return half ? { WL: r, WR: l } : { WR: r, WL: l }; };
      var fh = function (pos) { return half ? { HR: pos } : { HL: pos }; };
      kk.push(K(o + 0, HINGE, FEET_SW, w(1, 0), fh(arc(4, -sg * 0.24, 0.55)), { B: arc(8, sg * 0.05), BA: 1, BG: 0, EL: EL2, ER: ER2 }));
      kk.push(K(o + 0.085, SNAP, w(1, 0), fh(arc(30, -sg * 0.24, 0.55)), { B: arc(46, sg * 0.08) }));
      kk.push(K(o + 0.15, TALL, w(1, 0), fh(arc(80, -sg * 0.14, 0.58)), { B: arc(86, sg * 0.04) }));
      kk.push(K(o + 0.18, TALL, w(1, 1), { B: arc(92, 0, 0.59) }));
      kk.push(K(o + 0.215, TALL, w(0, 1), fh(arc(78, sg * 0.18, 0.56)), { B: arc(86, -sg * 0.05) }));
      kk.push(K(o + 0.28, TALL, w(0, 1), fh(arc(30, sg * 0.24, 0.55)), { R: [-1, 0, 0], B: arc(55, -sg * 0.07) }));
      kk.push(K(o + 0.37, CATCH, w(0, 1), fh(arc(10, sg * 0.24, 0.55)), { B: arc(18, -sg * 0.06) }));
    }
    def('swing_alt', { dur: 3.8, az: -50, thumb: 0.18, dbl: false }, kk);
  })();
  def('swing_american', { dur: 2.3, az: -62, thumb: 0.4, dbl: false }, [
    K(0, HINGE, FEET_SW, { B: arc(8, 0, 0.585), BA: 1, BG: 0, WL: 1, WR: 1, EL: EL2, ER: ER2 }),
    K(0.16, SNAP, { B: arc(48, 0, 0.585) }),
    K(0.27, TALL, { B: arc(110, 0, 0.585), EL: [0.6, 0, -1], ER: [-0.6, 0, -1] }),
    K(0.4, TALL, { R: [-5, 0, 0], C: [-4, 0, 0], B: arc(176, 0, 0.585), EL: [1, 0, -0.2], ER: [-1, 0, -0.2] }),
    K(0.47, TALL, { R: [-5, 0, 0], C: [-4, 0, 0], B: arc(174, 0, 0.585) }),
    K(0.6, TALL, { R: [-1, 0, 0], B: arc(95, 0, 0.585), EL: EL2, ER: ER2 }),
    K(0.77, CATCH, { B: arc(22, 0, 0.585) })
  ]);

  // ---- deadlifts ----------------------------------------------------
  def('deadlift', { dur: 3.2, bframe: 'root', az: -60, thumb: 0.34, dbl: false }, [
    K(0, STAND, { FL: [0.21, 0.075, 0.0], FR: [-0.21, 0.075, 0.0], FLr: [0, 14, 0], FRr: [0, -14, 0],
      B: [0, 0.8, 0.2], BG: 1, WL: 1, WR: 1, HA: 0, EL: [0.8, -0.2, -0.5], ER: [-0.8, -0.2, -0.5] }),
    K(0.12, STAND, { B: [0, 0.8, 0.2] }),
    K(0.45, { P: [0, 0.7, -0.28], R: [70, 0, 0], S: [3, 0, 0], N: [-34, 0, 0], B: [0, 0.262, 0.06] }),
    K(0.58, { P: [0, 0.7, -0.28], R: [70, 0, 0], S: [3, 0, 0], N: [-34, 0, 0], B: [0, 0.262, 0.06] }),
    K(0.9, STAND, { B: [0, 0.8, 0.2] })
  ]);
  def('sl_deadlift', { dur: 3.6, bframe: 'root', az: -78, thumb: 0.5 }, [
    K(0, STAND, { P: [0.03, 1, 0], FL: [0.1, 0.075, 0.0], FR: [-0.11, 0.075, 0.0], FRr: [0, -6, 0],
      B: [-0.13, 0.8, 0.19], BOV: 0, BVR: -0.61, BG: 1, WR: 1, WL: 0, HA: 90, HL: [0.23, -0.43, 0.06] }),
    K(0.14, { P: [0.03, 1, -0.02], R: [10, 0, 0], FR: [-0.11, 0.13, -0.14], FRr: [25, -6, 0], B: [-0.13, 0.78, 0.24] }),
    K(0.47, { P: [0.04, 0.92, -0.13], R: [78, 0, 0], S: [2, 0, 0], N: [-28, 0, 0], BOV: 1,
      FR: [-0.06, 0.735, -1.035], FRr: [92, -4, 0], KR: [0, -1, 0.2], HL: [0.33, -0.25, 0.22] }),
    K(0.6, { P: [0.04, 0.92, -0.13], R: [78, 0, 0], S: [2, 0, 0], N: [-28, 0, 0],
      FR: [-0.06, 0.735, -1.035], FRr: [92, -4, 0], KR: [0, -1, 0.2], HL: [0.33, -0.25, 0.22] }),
    K(0.88, STAND, { P: [0.03, 1, -0.02], R: [8, 0, 0], FR: [-0.11, 0.12, -0.12], FRr: [22, -6, 0], KR: [0, 0, 1], HL: [0.23, -0.43, 0.06], BOV: 0, B: [-0.13, 0.78, 0.24] })
  ]);
  def('suitcase_deadlift', { dur: 3.2, bframe: 'root', az: -25, thumb: 0.33 }, [
    K(0, STAND, { FL: [0.14, 0.075, 0], FR: [-0.14, 0.075, 0], FLr: [0, 10, 0], FRr: [0, -10, 0],
      B: [-0.3, 0.79, 0.0], BG: 1, WR: 1, WL: 0, HA: 90, HL: [0.27, -0.42, 0.06], ER: [-0.3, -0.2, -1] }),
    K(0.12, STAND, { B: [-0.3, 0.79, 0.0] }),
    K(0.45, { P: [0, 0.52, -0.17], R: [40, 0, 0], S: [4, 0, 0], C: [0, 0, 2], N: [-25, 0, 0], B: [-0.335, 0.262, 0.03], HL: [0.3, -0.3, 0.2] }),
    K(0.58, { P: [0, 0.52, -0.17], R: [40, 0, 0], S: [4, 0, 0], C: [0, 0, 2], N: [-25, 0, 0], B: [-0.335, 0.262, 0.03], HL: [0.3, -0.3, 0.2] }),
    K(0.9, STAND, { B: [-0.3, 0.79, 0.0], HL: [0.27, -0.42, 0.06] })
  ]);

  // ---- squats -------------------------------------------------------
  var SQ_DOWN = { P: [0, 0.53, -0.17], R: [30, 0, 0], S: [4, 0, 0], C: [-12, 0, 0], N: [-12, 0, 0] };
  def('goblet_squat', { dur: 3.0, az: -40, thumb: 0.5, dbl: false }, [
    K(0, STAND, FEET_SQ, { R: [3, 0, 0], B: GOB, BD: GOB_BD, BG: 0, HN: 1, WL: 1, WR: 1, EL: GOB_EL, ER: GOB_ER }),
    K(0.14, STAND, { R: [3, 0, 0] }),
    K(0.5, SQ_DOWN), K(0.62, SQ_DOWN),
    K(0.94, STAND, { R: [3, 0, 0] })
  ]);
  def('front_squat', { dur: 3.0, az: -40, thumb: 0.5 }, [
    K(0, STAND, FEET_SQ, { R: [2, 0, 0], B: RACK, BD: RACK_BD, BG: 0, WR: 1, WL: 0, ER: RACK_E, HL: [0.3, -0.3, 0.16] }),
    K(0.14, STAND, { R: [2, 0, 0] }),
    K(0.5, SQ_DOWN, { HL: [0.28, -0.12, 0.36] }), K(0.62, SQ_DOWN, { HL: [0.28, -0.12, 0.36] }),
    K(0.94, STAND, { R: [2, 0, 0], HL: [0.3, -0.3, 0.16] })
  ]);
  def('sumo_high_pull', { dur: 2.6, bframe: 'root', az: -40, thumb: 0.45, dbl: false }, [
    K(0, { P: [0, 0.56, -0.12], R: [42, 0, 0], S: [3, 0, 0], N: [-28, 0, 0],
      FL: [0.34, 0.075, 0.02], FR: [-0.34, 0.075, 0.02], FLr: [0, 32, 0], FRr: [0, -32, 0], KL: [0.1, 0, 1], KR: [-0.1, 0, 1],
      B: [0, 0.262, 0.05], BG: 1, WL: 1, WR: 1, EL: [1, -0.2, -0.3], ER: [-1, -0.2, -0.3] }),
    K(0.1, { P: [0, 0.56, -0.12], R: [42, 0, 0], B: [0, 0.262, 0.05] }),
    K(0.3, { P: [0, 0.94, -0.03], R: [8, 0, 0], N: [-5, 0, 0], B: [0, 0.68, 0.14] }),
    K(0.43, { P: [0, 0.99, 0], R: [-3, 0, 0], N: [0, 0, 0], B: [0, 1.33, 0.25], EL: [1, 0.7, -0.4], ER: [-1, 0.7, -0.4] }),
    K(0.52, { B: [0, 1.33, 0.25] }),
    K(0.7, { P: [0, 0.94, -0.03], R: [8, 0, 0], N: [-5, 0, 0], B: [0, 0.68, 0.14], EL: [1, -0.2, -0.3], ER: [-1, -0.2, -0.3] }),
    K(0.92, { P: [0, 0.56, -0.12], R: [42, 0, 0], N: [-28, 0, 0], B: [0, 0.262, 0.05] })
  ]);

  // ---- ballistics / grinds from the rack -----------------------------
  var STANCE = { FL: [0.15, 0.075, 0.02], FR: [-0.15, 0.075, 0.02], FLr: [0, 12, 0], FRr: [0, -12, 0] };
  def('clean', { dur: 2.6, az: -50, thumb: 0.4, dblWide: true }, [
    K(0, HINGE, FEET_SW, { B: arc(8, -0.05), BD: [0, -0.6, 0.8], BA: 1, BG: 0, WR: 1, WL: 0, ER: ER2, HL: arc(4, 0.25, 0.55) }),
    K(0.16, SNAP, { B: arc(40, -0.08), HL: arc(20, 0.26, 0.55) }),
    K(0.27, TALL, { R: [0, 0, 0], B: [-0.12, -0.0, 0.2], BA: 0.3, BD: [-0.4, -0.85, 0.3], ER: [-0.7, -0.5, -0.5], HL: [0.28, -0.35, 0.14] }),
    K(0.36, STAND, { P: [0, 0.965, 0], B: RACK, BD: RACK_BD, BA: 0, ER: RACK_E }),
    K(0.44, STAND, { B: RACK }),
    K(0.6, STAND, { B: RACK }),
    K(0.7, TALL, { R: [0, 0, 0], B: [-0.12, -0.04, 0.24], BA: 0.4, BD: [-0.4, -0.85, 0.3], ER: [-0.6, -0.5, -0.5] }),
    K(0.81, SNAP, { P: [0, 0.97, -0.05], R: [22, 0, 0], B: arc(32, -0.07), BA: 1, ER: ER2, HL: arc(20, 0.26, 0.55) })
  ]);
  def('press', { dur: 3.0, az: -30, thumb: 0.3 }, [
    K(0, STAND, STANCE, { B: RACK, BD: RACK_BD, BG: 0, WR: 1, WL: 0, ER: RACK_E, HL: FREE_OUT }),
    K(0.12, { B: RACK }),
    K(0.3, { B: MIDP, BD: MIDP_BD, ER: MIDP_E, C: [0, 0, -2] }),
    K(0.47, { B: OVER, BD: OVER_BD, BOV: 1, ER: OVER_E, C: [-2, 0, -4] }),
    K(0.6, { B: OVER, BOV: 1 }),
    K(0.76, { B: MIDP, BD: MIDP_BD, BOV: 0, ER: MIDP_E, C: [0, 0, -2] }),
    K(0.92, { B: RACK, BD: RACK_BD, ER: RACK_E, C: [0, 0, 0] })
  ]);
  def('push_press', { dur: 2.6, az: -30, thumb: 0.38 }, [
    K(0, STAND, STANCE, { B: RACK, BD: RACK_BD, BG: 0, WR: 1, WL: 0, ER: RACK_E, HL: FREE_OUT }),
    K(0.1, { P: [0, 1, 0], B: RACK }),
    K(0.2, { P: [0, 0.9, -0.01], B: RACK }),
    K(0.27, { P: [0, 1.0, 0], B: MIDP, BD: MIDP_BD, ER: MIDP_E }),
    K(0.36, { B: OVER, BD: OVER_BD, BOV: 1, ER: OVER_E, C: [-2, 0, -4] }),
    K(0.55, { B: OVER, BOV: 1 }),
    K(0.72, { B: MIDP, BD: MIDP_BD, BOV: 0, ER: MIDP_E, C: [0, 0, -2] }),
    K(0.83, { P: [0, 0.95, 0], B: RACK, BD: RACK_BD, ER: RACK_E, C: [0, 0, 0] }),
    K(0.92, { P: [0, 1, 0] })
  ]);
  def('jerk', { dur: 2.8, az: -35, thumb: 0.32 }, [
    K(0, STAND, STANCE, { B: RACK, BD: RACK_BD, BG: 0, WR: 1, WL: 0, ER: RACK_E, HL: FREE_OUT }),
    K(0.1, { P: [0, 1, 0], B: RACK }),
    K(0.18, { P: [0, 0.9, -0.01], B: RACK }),
    K(0.24, { P: [0, 1.0, 0], B: [-0.22, 0.3, 0.12], BD: MIDP_BD, ER: MIDP_E }),
    K(0.31, { P: [0, 0.8, -0.03], R: [6, 0, 0], B: OVER, BD: OVER_BD, BOV: 1, ER: OVER_E, C: [-2, 0, -3] }),
    K(0.37, { P: [0, 0.8, -0.03], R: [6, 0, 0] }),
    K(0.5, { P: [0, 1, 0], R: [0, 0, 0] }),
    K(0.6, { B: OVER, BOV: 1 }),
    K(0.74, { B: MIDP, BD: MIDP_BD, BOV: 0, ER: MIDP_E, C: [0, 0, -2] }),
    K(0.84, { P: [0, 0.95, 0], B: RACK, BD: RACK_BD, ER: RACK_E, C: [0, 0, 0] }),
    K(0.92, { P: [0, 1, 0] })
  ]);
  def('snatch', { dur: 2.8, az: -45, thumb: 0.45, dblWide: true }, [
    K(0, HINGE, FEET_SW, { B: arc(8, -0.05), BD: [0, -0.6, 0.8], BA: 1, BG: 0, WR: 1, WL: 0, ER: ER2, HL: arc(4, 0.25, 0.55) }),
    K(0.15, SNAP, { B: arc(44, -0.08), HL: arc(25, 0.27, 0.55) }),
    K(0.25, TALL, { R: [0, 0, 0], B: [-0.19, 0.33, 0.24], BA: 0.75, BD: MIDP_BD, ER: [-1, 0.5, -0.5], HL: [0.3, -0.33, 0.12] }),
    K(0.34, STAND, { P: [0, 0.97, 0], B: OVER, BD: OVER_BD, BA: 0, BOV: 1, ER: OVER_E, C: [-2, 0, -3] }),
    K(0.42, STAND, { B: OVER, C: [-2, 0, -3] }),
    K(0.55, STAND, { B: OVER, C: [-2, 0, -3] }),
    K(0.64, TALL, { R: [0, 0, 0], B: arc(140, -0.13), BOV: 0, BA: 0.7, ER: [-1, 0, -0.4], C: [0, 0, 0] }),
    K(0.74, TALL, { B: arc(85, -0.1), BA: 1, ER: ER2 }),
    K(0.86, CATCH, { B: arc(26, -0.07), HL: arc(15, 0.26, 0.55) })
  ]);
  def('bent_row', { dur: 2.8, az: -70, thumb: 0.45,
    dblPose: { FL: [0.14, 0.075, 0.0], FR: [-0.14, 0.075, 0.0], FLr: [0, 10, 0], FRr: [0, -10, 0], P: [0, 0.9, -0.22], R: [64, 0, 0] } }, [
    K(0, { P: [0, 0.86, -0.14], R: [52, 0, 0], S: [3, 0, 0], C: [0, 0, 0], N: [-25, 0, 0],
      FL: [0.15, 0.075, 0.2], FR: [-0.16, 0.075, -0.36], FLr: [0, 8, 0], FRr: [0, -14, 0],
      B: [-0.2, -0.45, 0.06], BOV: 1, BVR: -0.61, BG: 1, WR: 1, WL: 0, HA: 90, ER: [-0.3, 0.2, -1], HL: [0.16, -0.46, 0.27] }),
    K(0.14, { B: [-0.2, -0.45, 0.06], BOV: 1 }),
    K(0.45, { B: [-0.27, -0.2, 0.02], BOV: 0, ER: [-0.3, 0.5, -1], C: [0, -10, 0] }),
    K(0.58, { B: [-0.27, -0.2, 0.02], BOV: 0, C: [0, -10, 0] }),
    K(0.88, { B: [-0.2, -0.45, 0.06], BOV: 1, C: [0, 0, 0], ER: [-0.3, 0.2, -1] })
  ]);
  (function () {
    var plank = { P: [0, 0.62, 0.05], R: [58, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [-22, 0, 0],
      FL: [0.24, 0.16, -0.72], FR: [-0.24, 0.16, -0.72], FLr: [40, 8, 0], FRr: [40, -8, 0], KL: [0, -1, 0], KR: [0, -1, 0] };
    var bR = [-0.17, 0.262, 0.42], bL = [0.17, 0.262, 0.42], upR = [-0.22, 0.6, 0.15], upL = [0.22, 0.6, 0.15];
    var b = { BG: 1, WR: 1, WL: 0, BG2: 1, WL2: 1, WR2: 0, HA: 90, HA2: 90 };
    def('renegade_row', { dur: 4.0, bframe: 'root', b2frame: 'root', hframe: 'root', bells: 2, yaw: 90, az: 38, el: 16, thumb: 0.27, dbl: false, clamp: false }, [
      K(0, plank, b, { B: bR, B2: bL, ER: [-0.6, 0, -0.4], EL: [0.6, 0, -0.4] }),
      K(0.08, { B: bR, B2: bL }),
      K(0.25, { B: upR, C: [0, -14, 0], ER: [-0.2, 0, -1] }),
      K(0.32, { B: upR, C: [0, -14, 0] }),
      K(0.47, { B: bR, C: [0, 0, 0], ER: [-0.6, 0, -0.4] }),
      K(0.58, { B2: bL }),
      K(0.75, { B2: upL, C: [0, 14, 0], EL: [0.2, 0, -1] }),
      K(0.82, { B2: upL, C: [0, 14, 0] }),
      K(0.97, { B2: bL, C: [0, 0, 0], EL: [0.6, 0, -0.4] })
    ]);
  })();

  // ---- around the body ----------------------------------------------
  (function () {
    var kk = [], i;
    for (i = 0; i <= 8; i++) {
      var phi = -45 * i, a = phi * D2R;
      var rad = 0.25 + 0.04 * Math.max(0, Math.cos(a)) - 0.01 * Math.max(0, -Math.cos(a));
      var rx = Math.sin(a), rz = Math.cos(a);
      var y = 0.26 - 0.19 * Math.max(0, rz) - 0.02 * Math.max(0, -rz);
      var bd = [rx * 0.3, 1, rz * 0.3];
      var el = [rx * -0.6 + 0.6, -0.4 - 0.5 * Math.max(0, rz), -rz * 0.7 - 0.2];
      var er = [rx * -0.6 - 0.6, -0.4 - 0.5 * Math.max(0, rz), -rz * 0.7 - 0.2];
      kk.push(K(i / 8, { B: [rx * rad, y, rz * rad], BD: bd, BG: 0, HN: 1, HA: phi, WL: 1, WR: 1, EL: el, ER: er, N: [8 * rz, 0, 0] }));
    }
    kk[8].t = 1;
    def('halo', { dur: 3.4, az: -30, el: 8, thumb: 0.25, dbl: false }, [K(0, STAND, FEET_HIP)].map(function (x) { return ext(x, kk[0]); }).concat(kk.slice(1)));
  })();
  (function () {
    var pts = [[0, 0.86, 0.31], [-0.25, 0.86, 0.23], [-0.37, 0.88, 0], [-0.25, 0.9, -0.21], [0, 0.9, -0.27],
      [0.25, 0.9, -0.21], [0.37, 0.88, 0], [0.25, 0.86, 0.23]];
    var wr = [1, 1, 1, 1, 1, 0, 0, 0], wl = [1, 0, 0, 0, 1, 1, 1, 1];
    var hl = [null, [0.27, 0.84, 0.15], [0.32, 0.88, -0.1], [0.18, 0.9, -0.25], null, null, null, null];
    var hr = [null, null, null, null, null, [-0.18, 0.9, -0.25], [-0.32, 0.88, -0.1], [-0.27, 0.84, 0.15]];
    var kk = [];
    for (var i = 0; i < 8; i++) {
      var k = { B: pts[i], WR: wr[i], WL: wl[i], BG: 1, HA: 0 };
      if (hl[i]) k.HL = hl[i];
      if (hr[i]) k.HR = hr[i];
      if (i === 0) k = ext(STAND, FEET_HIP, { EL: [1, -0.4, -0.5], ER: [-1, -0.4, -0.5], HL: [0.12, 0.86, 0.3], HR: [-0.12, 0.86, 0.3] }, k);
      if (i === 4) { k.HL = [0.1, 0.9, -0.27]; k.HR = [-0.1, 0.9, -0.27]; }
      kk.push(K(i / 8, k));
    }
    def('around_world', { dur: 2.8, bframe: 'root', hframe: 'root', az: -30, el: 14, thumb: 0.25, dbl: false }, kk);
  })();
  (function () {
    var base = { P: [0, 0.68, -0.2], R: [60, 0, 0], S: [4, 0, 0], C: [0, 0, 0], N: [-36, 0, 0],
      FL: [0.33, 0.075, 0.02], FR: [-0.33, 0.075, 0.02], FLr: [0, 18, 0], FRr: [0, -18, 0], KL: [0.1, 0, 1], KR: [-0.1, 0, 1],
      BG: 1, EL: [1, 0, -0.1], ER: [-1, 0, -0.1] };
    var mid = [0, 0.44, -0.02];
    var half = function (s, o, first) {   // s=+1: around the LEFT leg (left hand carries)
      var carry = s > 0 ? 'WL' : 'WR', other = s > 0 ? 'WR' : 'WL', freeH = s > 0 ? 'HR' : 'HL', carryH = s > 0 ? 'HL' : 'HR';
      var k = [];
      var a = {}; a[carry] = 1; a[other] = 1; a.B = mid; a[carryH] = [s * 0.33, 0.46, -0.2]; a[freeH] = [-s * 0.04, 0.45, 0.25];
      k.push(K(o, first ? base : {}, a));
      var b = {}; b[carry] = 1; b[other] = 0; b.B = [s * 0.27, 0.44, -0.2]; b[freeH] = [-s * 0.12, 0.56, 0.22]; k.push(K(o + 0.12, b));
      var c = {}; c.B = [s * 0.5, 0.47, 0.02]; c[freeH] = [-s * 0.14, 0.56, 0.24]; k.push(K(o + 0.24, c));
      var d = {}; d.B = [s * 0.3, 0.47, 0.3]; d[freeH] = [-s * 0.42, 0.5, 0.06]; k.push(K(o + 0.35, d));
      var e = {}; e[carry] = 1; e[other] = 0; e.B = [s * 0.04, 0.45, 0.25]; e[freeH] = [-s * 0.33, 0.46, -0.2]; k.push(K(o + 0.44, e));
      return k;
    };
    def('figure8', { dur: 3.6, bframe: 'root', hframe: 'root', az: -30, el: 16, thumb: 0.25, dbl: false },
      half(1, 0, true).concat(half(-1, 0.5, false)));
  })();

  // ---- overhead stability -------------------------------------------
  def('windmill', { dur: 4.2, hframe: 'root', az: -10, el: 8, thumb: 0.5, dbl: false }, [
    K(0, STAND, { R: [0, 32, 0], C: [0, -12, 0], N: [-10, -15, 0],
      FL: [0.2, 0.075, 0.06], FR: [-0.18, 0.075, -0.06], FLr: [0, 48, 0], FRr: [0, 38, 0],
      B: OVER, BD: OVER_BD, BG: 0, BOV: 1, WR: 1, WL: 0, ER: OVER_E, HL: [0.28, 0.6, 0.18], EL: [0.3, -0.2, -1] }),
    K(0.12, { B: OVER }),
    K(0.5, { P: [-0.2, 0.83, -0.12], R: [36, 30, -68], S: [2, -6, -10], C: [0, -26, -6], N: [-5, -50, 0], HL: [0.32, 0.08, 0.2] }),
    K(0.62, { P: [-0.2, 0.83, -0.12], R: [36, 30, -68], S: [2, -6, -10], C: [0, -26, -6], N: [-5, -50, 0], HL: [0.32, 0.08, 0.2] }),
    K(0.94, STAND, { R: [0, 32, 0], C: [0, -12, 0], N: [-10, -15, 0], HL: [0.28, 0.6, 0.18] })
  ]);
  (function () {
    // Turkish get-up: stages up, then the same stages in reverse.
    var S0 = { P: [0, 0.12, 0], R: [-90, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [-10, 0, 0],
      FR: [-0.16, 0.075, 0.42], FRr: [0, -4, 0], KR: [0, 1, 0.3],
      FL: [0.52, 0.065, 0.8], FLr: [-80, 25, 0], KL: [0, 1, 0],
      HL: [0.62, 0.05, -0.02], EL: [1, 0, 0.1],
      B: [-0.18, 0.72, -0.42], BD: [0.1, -0.55, -0.8], BG: 0, BOV: 1, BVR: 0.6, WR: 1, WL: 0, ER: [-1, 0, -0.3] };
    var S1 = { P: [0.02, 0.12, 0.02], R: [-70, 0, 0], S: [16, 12, -4], C: [18, 12, -4], N: [-12, -10, 0],
      HL: [0.52, 0.04, -0.14], EL: [0.9, -0.2, -0.5] };
    var S2 = { P: [0.03, 0.13, 0.02], R: [-55, 0, 0], S: [14, 10, -6], C: [14, 10, -4], N: [-14, -14, 0],
      HL: [0.5, 0.03, -0.3], EL: [0.4, 0.2, -1] };
    var S3 = { P: [0.0, 0.46, 0.04], R: [-100, 0, -6], S: [8, 22, -12], C: [12, 20, -6], N: [-14, -20, 0],
      FL: [0.5, 0.065, 0.76], FLr: [-80, 25, 0], EL: [1, 0.3, -0.2] };
    var S4 = { P: [-0.03, 0.6, -0.12], R: [-25, 0, -24], S: [6, 10, -12], C: [6, 6, -10], N: [-14, -14, 0],
      FL: [0.07, 0.24, -0.46], FLr: [70, 0, 0], KL: [0, 0, 1], FR: [-0.16, 0.075, 0.42], FRr: [0, 0, 0], KR: [0, 0.6, 1] };
    var S5 = { P: [-0.03, 0.6, -0.14], R: [0, 0, -40], S: [4, 4, -8], C: [0, 0, -6], N: [-14, -10, 6],
      FL: [0.06, 0.19, -0.5], FLr: [70, 0, 0], KR: [0, 0, 1] };
    var S6 = { P: [-0.04, 0.59, -0.13], R: [0, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [-12, 0, 0],
      HL: [0.28, 0.5, -0.08], EL: [0.3, -0.2, -1] };
    var S7 = { P: [-0.06, 0.78, 0.12], R: [8, 0, 0], N: [-8, 0, 0], FL: [0.06, 0.17, -0.42], FLr: [48, 0, 0], HL: [0.27, 0.68, 0.14] };
    var S7b = { P: [-0.06, 0.95, 0.36], R: [4, 0, 0], N: [-6, 0, 0], FL: [0.07, 0.17, 0.12], FLr: [10, 4, 0], HL: [0.25, 0.86, 0.38] };
    var S8 = { P: [-0.03, 1.0, 0.42], R: [0, 0, 0], N: [-8, 0, 0], FL: [0.09, 0.075, 0.43], FLr: [0, 8, 0], HL: [0.25, 0.86, 0.45] };
    var up = [S0, S0, S1, S2, S3, S4, S5, S6, S7, S7b, S8, S8];
    var tu = [0, 0.03, 0.09, 0.15, 0.21, 0.26, 0.3, 0.35, 0.405, 0.44, 0.47, 0.53];
    var kk = [], cur = {}, i, snap = [];
    for (i = 0; i < up.length; i++) { cur = ext(cur, up[i]); snap.push(ext(cur)); kk.push(K(tu[i], snap[i])); }
    // reverse order (skip the duplicate top and bottom)
    var down = [9, 8, 7, 6, 5, 4, 3, 2];
    var td = [0.56, 0.6, 0.65, 0.7, 0.74, 0.79, 0.85, 0.91];
    for (i = 0; i < down.length; i++) {
      var k = ext(snap[down[i]]);
      kk.push(K(td[i], k));
    }
    def('tgu', { dur: 20, bframe: 'root', hframe: 'root', yaw: 90, az: -32, el: 14, thumb: 0.35, dbl: false, clamp: false }, kk);
  })();

  // ---- lunges ---------------------------------------------------------
  def('reverse_lunge', { dur: 3.2, az: -75, thumb: 0.48 }, [
    K(0, STAND, { FL: [0.11, 0.075, 0.08], FR: [-0.12, 0.075, 0.0], FLr: [0, 6, 0], FRr: [0, -6, 0],
      B: RACK, BD: RACK_BD, BG: 0, WR: 1, WL: 0, ER: RACK_E, HL: FREE_OUT }),
    K(0.1, { FR: [-0.12, 0.075, 0.0], FRr: [0, -6, 0] }),
    K(0.24, { P: [0, 0.96, -0.08], FR: [-0.13, 0.15, -0.32], FRr: [25, -4, 0] }),
    K(0.44, { P: [0, 0.56, -0.28], R: [6, 0, 0], N: [-6, 0, 0], FR: [-0.13, 0.155, -0.66], FRr: [40, -4, 0] }),
    K(0.56, { P: [0, 0.56, -0.28], R: [6, 0, 0], FR: [-0.13, 0.155, -0.66], FRr: [40, -4, 0] }),
    K(0.74, { P: [0, 0.96, -0.08], R: [0, 0, 0], N: [0, 0, 0], FR: [-0.13, 0.15, -0.32], FRr: [25, -4, 0] }),
    K(0.88, { P: [0, 1, 0], FR: [-0.12, 0.075, 0.0], FRr: [0, -6, 0] })
  ]);
  (function () {
    var feet = { FL: [0.45, 0.075, 0.02], FR: [-0.45, 0.075, 0.02], FLr: [0, 18, 0], FRr: [0, -18, 0], KL: [0.1, 0, 1], KR: [-0.1, 0, 1] };
    var mid = { P: [0, 0.96, 0], R: [4, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [0, 0, 0] };
    var right = { P: [-0.3, 0.57, -0.13], R: [26, -8, 0], S: [3, 0, 0], C: [-10, 0, 0], N: [-10, 0, 0] };
    var left = { P: [0.3, 0.57, -0.13], R: [26, 8, 0], S: [3, 0, 0], C: [-10, 0, 0], N: [-10, 0, 0] };
    def('lateral_lunge', { dur: 4.4, az: -20, thumb: 0.31, dbl: false }, [
      K(0, mid, feet, { B: GOB, BD: GOB_BD, BG: 0, HN: 1, WL: 1, WR: 1, EL: GOB_EL, ER: GOB_ER }),
      K(0.25, right), K(0.36, right), K(0.5, mid), K(0.75, left), K(0.86, left)
    ]);
  })();

  // ---- floor ---------------------------------------------------------
  def('russian_twist', { dur: 2.6, az: -58, el: 24, thumb: 0.0, dbl: false, clamp: false }, [
    K(0, { P: [0, 0.135, 0], R: [-52, 0, 0], S: [10, 28, 0], C: [12, 26, 0], N: [12, 0, 0],
      FL: [0.2, 0.075, 0.56], FR: [-0.2, 0.075, 0.56], FLr: [0, 16, 0], FRr: [0, -16, 0], KL: [0.5, 1, 0.1], KR: [-0.5, 1, 0.1],
      B: [0, 0.06, 0.36], BD: [0, -1, -0.15], BG: 0, HN: 1, WL: 1, WR: 1, EL: [1, -0.6, -0.3], ER: [-1, -0.6, -0.3] }),
    K(0.5, { S: [10, -28, 0], C: [12, -26, 0] })
  ]);
  def('floor_press', { dur: 3.0, yaw: 90, az: -30, el: 22, thumb: 0.45, clamp: false }, [
    K(0, LIE, { B: [-0.38, -0.03, 0.26], BD: [-0.75, 0.1, -0.65], BG: 0, WR: 1, WL: 0, ER: [-0.6, -0.5, -1], HL: [0.48, -0.32, -0.05], EL: [0.2, 0, 1] }),
    K(0.12, { B: [-0.38, -0.03, 0.25] }),
    K(0.45, { B: [-0.18, 0.15, 0.6], BOV: 1, BD: [-0.55, 0.15, -0.8], ER: [-1, -0.2, -0.3] }),
    K(0.58, { B: [-0.18, 0.15, 0.6], BOV: 1 }),
    K(0.92, { B: [-0.38, -0.03, 0.25], BOV: 0, BD: [-0.75, 0.1, -0.65], ER: [-0.6, -0.5, -1] })
  ]);
  def('pullover', { dur: 3.4, yaw: 90, az: -30, el: 22, thumb: 0.3, dbl: false, clamp: false }, [
    K(0, LIE, { B: arcUp(4, 0, 0.58), BD: [0, -0.2, -1], BG: 1, BA: 0, HN: 1, WL: 1, WR: 1, EL: [0.8, -0.3, -0.2], ER: [-0.8, -0.3, -0.2] }),
    K(0.1, { B: arcUp(4, 0, 0.58) }),
    K(0.28, { B: arcUp(45, 0, 0.58), BG: 0.5, BA: 0.5 }),
    K(0.45, { B: arcUp(84, 0, 0.58), BG: 0, BA: 1 }),
    K(0.56, { B: arcUp(84, 0, 0.58) }),
    K(0.74, { B: arcUp(45, 0, 0.58), BG: 0.5, BA: 0.5 }),
    K(0.92, { B: arcUp(4, 0, 0.58), BG: 1, BA: 0 })
  ]);
  def('glute_bridge', { dur: 2.8, yaw: 90, az: -30, el: 20, bframe: 'pelvis', thumb: 0.45, dbl: false, clamp: false }, [
    K(0, LIE, { FL: [0.15, 0.075, 0.38], FR: [-0.15, 0.075, 0.38], N: [-6, 0, 0],
      B: [0, -0.04, 0.37], BD: [0, 0, -1], BG: 0, HN: 0.4, WL: 1, WR: 1, EL: [1, 0, -0.8], ER: [-1, 0, -0.8] }),
    K(0.12, { P: [0, 0.12, 0], R: [-90, 0, 0] }),
    K(0.45, { P: [0, 0.34, -0.05], R: [-120, 0, 0], S: [2, 0, 0], C: [14, 0, 0], N: [6, 0, 0] }),
    K(0.6, { P: [0, 0.34, -0.05], R: [-120, 0, 0], S: [2, 0, 0], C: [14, 0, 0], N: [6, 0, 0] }),
    K(0.9, { P: [0, 0.12, 0], R: [-90, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [-6, 0, 0] })
  ]);
  def('situp', { dur: 3.2, yaw: 90, az: -26, el: 32, thumb: 0.42, dbl: false, clamp: false }, [
    K(0, LIE, { FL: [0.13, 0.075, 0.58], FR: [-0.13, 0.075, 0.58],
      B: [0, 0.06, 0.24], BD: [0, -1, 0.1], BG: 0, HN: 1, WL: 1, WR: 1, EL: [0.6, -1, -0.2], ER: [-0.6, -1, -0.2] }),
    K(0.1, { P: [0, 0.12, 0], R: [-90, 0, 0] }),
    K(0.45, { P: [0, 0.125, 0.05], R: [-32, 0, 0], S: [14, 0, 0], C: [10, 0, 0], N: [10, 0, 0] }),
    K(0.56, { P: [0, 0.125, 0.05], R: [-32, 0, 0], S: [14, 0, 0], C: [10, 0, 0], N: [10, 0, 0] }),
    K(0.92, { P: [0, 0.12, 0], R: [-90, 0, 0], S: [0, 0, 0], C: [0, 0, 0], N: [0, 0, 0] })
  ]);

  // ---- carries (procedural walk) -------------------------------------
  function walk(u, p) {
    var ph = (u * 2) % 1, tau = Math.PI * 2;
    footStep(p.FL, p.FLr, ph, 0.11, 7);
    footStep(p.FR, p.FRr, (ph + 0.5) % 1, -0.11, -7);
    p.P[0] += 0.018 * Math.sin(tau * ph);
    p.P[1] = 1.0;
    p.R[1] += 5 * Math.cos(tau * ph);
    p.R[2] += 2.5 * Math.sin(tau * ph);
    p.C[1] -= 8 * Math.cos(tau * ph);
    p.N[1] += 3 * Math.cos(tau * ph);
    var sw = -Math.cos(tau * ph);  // left arm forward when right leg forward
    if (p.WL[0] < 0.5) { p.HL[2] += 0.15 * sw; p.HL[1] += 0.03 * Math.abs(sw); }
    if (p.WR[0] < 0.5 && p.BOV[0] < 0.5) { p.HR[2] -= 0.15 * sw; p.HR[1] += 0.03 * Math.abs(sw); }
  }
  function footStep(F, Fr, ph, x, yaw) {
    var stance = 0.6, half = 0.23;
    F[0] = x;
    if (ph < stance) {
      var s = ph / stance;
      F[2] = half - 2 * half * s; F[1] = 0.075;
      Fr[0] = s > 0.8 ? -(s - 0.8) * 60 * 0 : 0;
    } else {
      var w = (ph - stance) / (1 - stance), e = w * w * (3 - 2 * w);
      F[2] = -half + 2 * half * e;
      F[1] = 0.075 + 0.1 * Math.sin(Math.PI * w);
      Fr[0] = 22 * Math.sin(Math.PI * w) * (1 - w) * 1.6 - 10 * Math.sin(Math.PI * w) * w;
    }
    Fr[1] = yaw; Fr[2] = 0;
  }
  def('farmer_carry', { dur: 2.4, az: -35, thumb: 0.12, proc: walk }, [
    K(0, STAND, { C: [0, 0, -3], B: [-0.29, -0.44, 0.0], BG: 1, HA: 90, WR: 1, WL: 0, ER: [-0.6, 0, -1], HL: [0.22, -0.44, 0.02] })
  ]);
  def('overhead_carry', { dur: 2.4, az: -35, thumb: 0.12, proc: walk }, [
    K(0, STAND, { C: [0, 0, -3], B: OVER, BD: OVER_BD, BG: 0, BOV: 1, WR: 1, WL: 0, ER: OVER_E, HL: [0.22, -0.44, 0.02] })
  ]);
  def('thruster', { dur: 3.2, az: -38, thumb: 0.8, dbl: false }, [
    K(0, STAND, FEET_SQ, { B: GOB, BD: GOB_BD, BG: 0, HN: 1, WL: 1, WR: 1, EL: GOB_EL, ER: GOB_ER }),
    K(0.08, { B: GOB }),
    K(0.36, SQ_DOWN), K(0.44, SQ_DOWN),
    K(0.64, STAND, { P: [0, 1, 0], B: [0, 0.26, 0.24], BD: [0, 0.2, 1], EL: [0.8, -0.6, 0.2], ER: [-0.8, -0.6, 0.2] }),
    K(0.76, { B: [0, 0.74, 0.04], BD: [0, 1, -0.15], BOV: 1, EL: [1, 0, -0.2], ER: [-1, 0, -0.2] }),
    K(0.84, { B: [0, 0.74, 0.04], BOV: 1 }),
    K(0.94, { B: [0, 0.24, 0.25], BD: [0, 0.2, 1], BOV: 0, EL: [0.8, -0.6, 0.2], ER: [-0.8, -0.6, 0.2] })
  ]);

  /* ======================================================================
   * Geometry
   * ==================================================================== */
  function capsuleGeo(rTop, rBot, len, seg) {
    var pts = [], n = 5, i, a;
    for (i = 0; i <= n; i++) { a = -Math.PI / 2 + (Math.PI / 2) * i / n; pts.push(new THREE.Vector2(Math.max(1e-4, rBot * Math.cos(a)), -len + rBot * Math.sin(a))); }
    for (i = 0; i <= n; i++) { a = (Math.PI / 2) * i / n; pts.push(new THREE.Vector2(Math.max(1e-4, rTop * Math.cos(a)), rTop * Math.sin(a))); }
    return new THREE.LatheGeometry(pts, seg || 14);
  }
  function bellGeos() {
    var R = 0.105, cy = -0.17, flat = -0.09, pts = [new THREE.Vector2(1e-4, cy + flat)];
    var a0 = Math.asin(flat / R), n = 18, i, a;
    pts.push(new THREE.Vector2(R * Math.cos(a0) - 0.006, cy + flat));
    for (i = 0; i <= n; i++) { a = a0 + (Math.PI / 2 - a0) * i / n; pts.push(new THREE.Vector2(Math.max(1e-4, R * Math.cos(a)), cy + R * Math.sin(a))); }
    var body = new THREE.LatheGeometry(pts, 26);
    var hp = [[-0.074, -0.12], [-0.078, -0.07], [-0.076, -0.03], [-0.064, -0.007], [-0.036, 0.0], [0, 0.0],
      [0.036, 0.0], [0.064, -0.007], [0.076, -0.03], [0.078, -0.07], [0.074, -0.12]];
    var curve = new THREE.CatmullRomCurve3(hp.map(function (p) { return new V3(p[0], p[1], 0); }));
    var handle = new THREE.TubeGeometry(curve, 44, 0.0175, 10, false);
    // flat "competition" face plate (where the weight is printed)
    var plate = new THREE.CylinderGeometry(0.052, 0.052, 0.004, 28);
    plate.rotateX(Math.PI / 2);
    plate.translate(0, cy - 0.005, R - 0.006);
    return { body: body, handle: handle, plate: plate };
  }
  function radialTex(stops, size) {
    var c = document.createElement('canvas');
    c.width = c.height = size || 128;
    var g = c.getContext('2d'), r = c.width / 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    var t = new THREE.CanvasTexture(c);
    return t;
  }
  function setCol(mat, hex) { mat.color.set(hex); mat.color.convertSRGBToLinear(); }

  /* ======================================================================
   * Stage: scene + rig + bells + floor + fake shadows (one per viewer, one for thumbnails)
   * ==================================================================== */
  function Stage(colors) {
    var scene = this.scene = new THREE.Scene();
    var M = this.mats = {
      fig: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.02 }),
      acc: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }),
      bell: new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.15 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8e949b, roughness: 0.32, metalness: 0.55 }),
      plate: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, metalness: 0 }),
      floor: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      ring: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07, depthWrite: false })
    };
    M.steel.color.convertSRGBToLinear();
    var G = this.geos = {
      sph: new THREE.SphereGeometry(1, 20, 14),
      ball: new THREE.SphereGeometry(1, 20, 14),
      ua: capsuleGeo(0.05, 0.039, L_UA), fa: capsuleGeo(0.04, 0.029, L_FA),
      th: capsuleGeo(0.088, 0.054, L_THIGH), sh: capsuleGeo(0.056, 0.036, L_SHIN),
      yoke: capsuleGeo(0.056, 0.056, 0.25), neck: capsuleGeo(0.044, 0.05, 0.1),
      floor: new THREE.CircleGeometry(1.75, 64), ring: new THREE.RingGeometry(1.05, 1.064, 96),
      blob: new THREE.PlaneGeometry(1, 1)
    };
    G.yoke.translate(0, 0.125, 0);
    G.neck.translate(0, 0.1, 0);
    G.floor.rotateX(-Math.PI / 2); G.ring.rotateX(-Math.PI / 2); G.blob.rotateX(-Math.PI / 2);
    var bg = bellGeos(); G.bellBody = bg.body; G.bellHandle = bg.handle; G.bellPlate = bg.plate;
    this.tex = {
      floorA: radialTex([[0, '#fff'], [0.62, '#fff'], [1, '#000']], 256),
      blob: radialTex([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(0,0,0,0.75)'], [0.65, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']], 128)
    };
    M.floor.alphaMap = this.tex.floorA;

    // lights (key + rim rotate with the camera azimuth so the figure always reads well)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8a82, 0.82));
    var lr = this.lightRig = new THREE.Group();
    var key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(-1.7, 3.3, 2.6);
    var rim = new THREE.DirectionalLight(0xdce6ff, 0.65); rim.position.set(2.0, 2.2, -2.8);
    var fill = new THREE.DirectionalLight(0xfff4e6, 0.25); fill.position.set(2.5, 0.6, 2.0);
    lr.add(key, rim, fill);
    scene.add(lr);

    this.floor = new THREE.Mesh(G.floor, M.floor); this.floor.renderOrder = 0;
    this.ring = new THREE.Mesh(G.ring, M.ring); this.ring.position.y = 0.0005; this.ring.renderOrder = 1;
    scene.add(this.floor, this.ring);

    this.casters = [];
    this.buildRig();
    this.buildBells();
    this._mp = newPose();
    this.setColors(colors);
  }

  Stage.prototype.mesh = function (parent, geo, mat, pos, scl) {
    var m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scl) { if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(scl[0], scl[1], scl[2]); }
    parent.add(m);
    return m;
  };
  function node(parent, x, y, z) {
    var o = new THREE.Object3D();
    o.position.set(x, y, z); o.rotation.order = 'YXZ';
    parent.add(o);
    return o;
  }
  Stage.prototype.caster = function (nd, off, r, k, fall, foot) {
    var mat = new THREE.MeshBasicMaterial({ map: this.tex.blob, transparent: true, depthWrite: false, opacity: 0 });
    var m = new THREE.Mesh(this.geos.blob, mat);
    m.renderOrder = 2;
    this.scene.add(m);
    this.casters.push({ node: nd, off: new V3(off[0], off[1], off[2]), r: r, k: k, fall: fall, foot: !!foot, mesh: m });
  };

  Stage.prototype.buildRig = function () {
    var M = this.mats, G = this.geos, me = this;
    var root = new THREE.Group();
    this.scene.add(root);
    var pelvis = node(root, 0, 1, 0);
    this.mesh(pelvis, G.sph, M.fig, [0, -0.025, -0.005], [0.152, 0.105, 0.105]);
    this.mesh(pelvis, G.sph, M.acc, [0, -0.005, 0], [0.158, 0.03, 0.11]); // belt
    var spine = node(pelvis, 0, 0.1, 0);
    this.mesh(spine, G.sph, M.fig, [0, 0.07, 0.0], [0.13, 0.12, 0.092]);
    var chest = node(spine, 0, 0.17, 0);
    this.mesh(chest, G.sph, M.fig, [0, 0.07, 0.0], [0.17, 0.195, 0.112]);
    var yoke = this.mesh(chest, G.yoke, M.fig, [0, 0.135, -0.012]);
    yoke.rotation.z = Math.PI / 2;
    var neck = node(chest, 0, 0.2, 0);
    this.mesh(neck, G.neck, M.fig, [0, -0.04, -0.005]);
    var head = node(neck, 0, 0.08, 0);
    this.mesh(head, G.sph, M.fig, [0, 0.1, 0.0], [0.09, 0.112, 0.1]);
    this.mesh(head, G.sph, M.fig, [0, 0.04, 0.03], [0.066, 0.055, 0.07]);
    this.mesh(head, G.ball, M.acc, [0, 0.108, 0.035], [0.084, 0.019, 0.07]); // visor band shows facing
    var arms = {}, legs = {};
    [1, -1].forEach(function (s) {
      var nm = s > 0 ? 'L' : 'R';
      var ua = node(chest, SHO[0] * s, SHO[1], SHO[2]);
      me.mesh(ua, G.ball, M.acc, null, 0.062);
      me.mesh(ua, G.ua, M.fig);
      var fa = node(ua, 0, -L_UA, 0);
      me.mesh(fa, G.ball, M.acc, null, 0.05);
      me.mesh(fa, G.fa, M.fig);
      var hand = node(fa, 0, -L_FA, 0);
      hand.rotation.y = -s * 75 * D2R;
      me.mesh(hand, G.ball, M.acc, null, 0.036);
      me.mesh(hand, G.sph, M.fig, [0, -0.058, 0.004], [0.04, 0.056, 0.026]);
      me.mesh(hand, G.sph, M.fig, [s * 0.03, -0.035, 0.018], [0.014, 0.03, 0.014]); // thumb
      arms[nm] = { ua: ua, fa: fa, hand: hand, side: s, grip: new V3(), fdir: new V3(0, -1, 0), tgt: new V3() };
      var th = node(pelvis, HIP[0] * s, HIP[1], HIP[2]);
      me.mesh(th, G.ball, M.fig, null, 0.075);
      me.mesh(th, G.th, M.fig);
      var sh = node(th, 0, -L_THIGH, 0);
      me.mesh(sh, G.ball, M.acc, null, 0.066);
      me.mesh(sh, G.sh, M.fig);
      var ft = node(sh, 0, -L_SHIN, 0);
      me.mesh(ft, G.ball, M.acc, null, 0.045);
      me.mesh(ft, G.sph, M.fig, [0, -0.038, 0.068], [0.047, 0.036, 0.125]);
      legs[nm] = { th: th, sh: sh, ft: ft };
    });
    this.rig = { root: root, pelvis: pelvis, spine: spine, chest: chest, neck: neck, head: head, arm: arms, leg: legs };
    this.blendNodes = [root, pelvis, spine, chest, neck, head, arms.L.ua, arms.L.fa, arms.R.ua, arms.R.fa,
      legs.L.th, legs.L.sh, legs.L.ft, legs.R.th, legs.R.sh, legs.R.ft];
    // fake soft shadows
    this.caster(pelvis, [0, -0.02, 0], 0.15, 0.42, 0.95);
    this.caster(spine, [0, 0.07, 0], 0.13, 0.3, 0.95);
    this.caster(chest, [0, 0.07, 0], 0.16, 0.36, 1.1);
    this.caster(head, [0, 0.1, 0], 0.1, 0.3, 1.2);
    ['L', 'R'].forEach(function (nm) {
      me.caster(legs[nm].sh, [0, 0, 0], 0.055, 0.34, 0.45);
      me.caster(legs[nm].ft, [0, -0.04, 0.065], 0.07, 0.55, 0.3, true);
      me.caster(arms[nm].hand, [0, -0.05, 0], 0.05, 0.35, 0.4);
      me.caster(arms[nm].fa, [0, 0, 0], 0.045, 0.25, 0.4);
    });
  };

  Stage.prototype.buildBells = function () {
    var G = this.geos, M = this.mats, me = this;
    this.bells = [0, 1].map(function () {
      var g = new THREE.Group();
      me.mesh(g, G.bellBody, M.bell);
      me.mesh(g, G.bellHandle, M.steel);
      me.mesh(g, G.bellPlate, M.plate);
      me.scene.add(g);
      var b = { obj: g, grip: new V3(), d0: new V3(), ah: new V3(), ax: new V3(), down: new V3(), fq: new Qt(), w: [0, 0] };
      me.caster(g, [0, -0.17, 0], 0.11, 0.5, 0.7);
      b.shadow = me.casters[me.casters.length - 1];
      return b;
    });
    this.blendNodes.push(this.bells[0].obj, this.bells[1].obj);
  };

  Stage.prototype.setColors = function (c) {
    var M = this.mats;
    setCol(M.fig, c.figure || DEF_COLORS.figure);
    setCol(M.acc, c.figureAccent || DEF_COLORS.figureAccent);
    setCol(M.bell, c.bell || DEF_COLORS.bell);
    var hasFloor = !!c.floor;
    if (hasFloor) setCol(M.floor, c.floor);
    this.floor.visible = this.ring.visible = hasFloor && !this.noFloor;
  };

  Stage.prototype.frameNode = function (name) {
    var r = this.rig;
    return name === 'chest' ? r.chest : (name === 'pelvis' ? r.pelvis : r.root);
  };

  Stage.prototype.solveLeg = function (leg, F, Fr, Kp, pelvisQ, rootQ) {
    var hip = leg.th.getWorldPosition(_a);
    _t.set(F[0], F[1], F[2]); this.rig.root.localToWorld(_t);
    _e.set(Fr[0] * D2R, Fr[1] * D2R, Fr[2] * D2R, 'YXZ');
    _qf.setFromEuler(_e).premultiply(rootQ);
    _p.set(Kp[0], Kp[1], Kp[2]).applyAxisAngle(UP, Fr[1] * D2R).applyQuaternion(rootQ);
    ik2(hip, _t, L_THIGH, L_SHIN, _p, _mid, _end, _pn);
    boneQ(_dir.subVectors(_mid, hip).normalize(), _pn, _q1);
    leg.th.quaternion.copy(pelvisQ).invert().multiply(_q1);
    boneQ(_dir.subVectors(_end, _mid).normalize(), _pn, _q2);
    leg.sh.quaternion.copy(_q1).invert().multiply(_q2);
    leg.ft.quaternion.copy(_q2).invert().multiply(_qf);
  };

  Stage.prototype.solveArm = function (arm, target, poleC, chestQ) {
    var chest = this.rig.chest, s = arm.side;
    _tmp.copy(target); chest.worldToLocal(_tmp);
    var bx = SHO[0] * s, by = SHO[1], bz = SHO[2];
    _c.set(_tmp.x - bx, _tmp.y - by, _tmp.z - bz).normalize();
    var e = smooth((_c.y + 0.15) / 1.0);
    arm.ua.position.set(bx - s * 0.012 * e, by + 0.042 * e, bz);
    _s.copy(arm.ua.position); chest.localToWorld(_s);
    _p.set(poleC[0], poleC[1], poleC[2]).applyQuaternion(chestQ);
    ik2(_s, target, L_UA, L_FA + GRIP, _p, _mid, _end, _pn);
    _pn.negate();
    boneQ(_dir.subVectors(_mid, _s).normalize(), _pn, _q1);
    arm.ua.quaternion.copy(chestQ).invert().multiply(_q1);
    boneQ(_dir.subVectors(_end, _mid).normalize(), _pn, _q2);
    arm.fa.quaternion.copy(_q1).invert().multiply(_q2);
    arm.grip.copy(_end);
    arm.fdir.copy(_dir);
  };

  Stage.prototype.applyPose = function (pose, d, dbl) {
    var r = this.rig, p = pose, i, b, h;
    var mirror = !!dbl && d.dbl !== false;
    if (mirror) p = mirrorPose(pose, this._mp, d.dblWide, d.dblPose);
    var nb = (mirror || d.bells === 2) ? 2 : 1;
    r.root.rotation.set(0, (d.yaw || 0) * D2R, 0);
    r.pelvis.position.set(p.P[0], p.P[1], p.P[2]);
    r.pelvis.rotation.set(p.R[0] * D2R, p.R[1] * D2R, p.R[2] * D2R);
    r.root.updateMatrixWorld(true);
    if (d.clamp !== false) {
      var drop = 0, maxL = (L_THIGH + L_SHIN) * 0.985;
      ['L', 'R'].forEach(function (nm) {
        var F = nm === 'L' ? p.FL : p.FR;
        if (F[1] > 0.2) return;
        r.leg[nm].th.getWorldPosition(_a);
        _b.set(F[0], F[1], F[2]); r.root.localToWorld(_b);
        var dx = _a.x - _b.x, dz = _a.z - _b.z, h2 = dx * dx + dz * dz;
        if (h2 < maxL * maxL) {
          var ymax = _b.y + Math.sqrt(maxL * maxL - h2);
          if (_a.y > ymax) drop = Math.max(drop, _a.y - ymax);
        }
      });
      if (drop > 0) r.pelvis.position.y -= drop;
    }
    r.spine.rotation.set(p.S[0] * D2R, p.S[1] * D2R, p.S[2] * D2R);
    r.chest.rotation.set(p.C[0] * D2R, p.C[1] * D2R, p.C[2] * D2R);
    r.neck.rotation.set(p.N[0] * 0.4 * D2R, p.N[1] * 0.4 * D2R, p.N[2] * 0.4 * D2R);
    r.head.rotation.set(p.N[0] * 0.6 * D2R, p.N[1] * 0.6 * D2R, p.N[2] * 0.6 * D2R);
    r.root.updateMatrixWorld(true);
    var rootQ = r.root.getWorldQuaternion(_rq);
    var pelvisQ = r.pelvis.getWorldQuaternion(_pq);
    var chestQ = r.chest.getWorldQuaternion(_cq);
    this.solveLeg(r.leg.L, p.FL, p.FLr, p.KL, pelvisQ, rootQ);
    this.solveLeg(r.leg.R, p.FR, p.FRr, p.KR, pelvisQ, rootQ);

    // ---- bells: grip point, down direction, handle axis (pre arm IK)
    for (i = 0; i < 2; i++) {
      b = this.bells[i];
      b.obj.visible = i < nb;
      b.active = i < nb;
      if (!b.active) { b.w[0] = b.w[1] = 0; continue; }
      var c = BELL_CH[i], frame = this.frameNode(i === 0 ? d.bframe : (mirror ? d.bframe : d.b2frame));
      frame.getWorldQuaternion(b.fq);
      var B = p[c[0]], BD = p[c[1]];
      b.BA = clamp01(p[c[2]][0]); var BG = clamp01(p[c[3]][0]), BOV = clamp01(p[c[4]][0]), BVR = p[c[5]][0];
      b.w[0] = clamp01(p[c[6]][0]); b.w[1] = clamp01(p[c[7]][0]);
      var HA = p[c[8]][0] * D2R; b.HN = clamp01(p[c[9]][0]);
      b.d0.set(BD[0], BD[1], BD[2]).applyQuaternion(b.fq).normalize();
      if (BG > 0) { b.d0.lerp(DOWN, BG); if (b.d0.lengthSq() < 1e-6) b.d0.copy(DOWN); b.d0.normalize(); }
      b.ah.set(Math.cos(HA), 0, -Math.sin(HA)).applyQuaternion(b.fq);
      b.ax.copy(b.ah).addScaledVector(b.d0, -b.ah.dot(b.d0));
      if (b.ax.lengthSq() < 1e-6) b.ax.set(0, 0, 1).applyQuaternion(b.fq).addScaledVector(b.d0, -0.0);
      b.ax.normalize();
      b.grip.set(B[0], B[1], B[2]); frame.localToWorld(b.grip);
      if (BOV > 0) {
        // straight arm(s) vertical from the (elevated) shoulder(s)
        var wl = b.w[0], wr = b.w[1], sep2 = Math.min(wl, wr), ev = BVR > 0 ? 1 : 0;
        if (wl + wr < 1e-3) wr = 1;
        _a.set(SHO[0] - 0.012 * ev, SHO[1] + 0.042 * ev, SHO[2]); r.chest.localToWorld(_a);
        _b.set(-SHO[0] + 0.012 * ev, SHO[1] + 0.042 * ev, SHO[2]); r.chest.localToWorld(_b);
        _a.multiplyScalar(wl).addScaledVector(_b, wr).multiplyScalar(1 / (wl + wr));
        _a.addScaledVector(UP, BVR * (sep2 > 0.5 ? 0.985 : 1)).addScaledVector(b.d0, -0.05 * b.HN * sep2);
        b.grip.lerp(_a, BOV);
      }
    }
    // ---- hands
    var hands = ['L', 'R'];
    for (h = 0; h < 2; h++) {
      var nm = hands[h], arm = r.arm[nm], sgn = h === 0 ? 1 : -1;
      var H = nm === 'L' ? p.HL : p.HR;
      var free = _b.set(H[0], H[1], H[2]);
      this.frameNode(d.hframe).localToWorld(free);
      _c.set(0, 0, 0);
      var ws = 0;
      for (i = 0; i < nb; i++) {
        b = this.bells[i];
        var w = b.w[h];
        if (w <= 0) continue;
        var sep = Math.min(b.w[0], b.w[1]);
        _t.copy(b.grip).addScaledVector(b.ax, sgn * (0.055 + 0.032 * b.HN) * sep).addScaledVector(b.d0, 0.05 * b.HN * sep);
        _c.addScaledVector(_t, w); ws += w;
      }
      if (ws > 0) { _c.multiplyScalar(1 / ws); free.lerp(_c, Math.min(1, ws)); }
      arm.tgt.copy(free);
      this.solveArm(arm, arm.tgt, nm === 'L' ? p.EL : p.ER, chestQ);
    }
    // ---- bell final transform (follows the actual hands)
    for (i = 0; i < nb; i++) {
      b = this.bells[i];
      var cw = 0;
      _c.set(0, 0, 0); _d.set(0, 0, 0);
      for (h = 0; h < 2; h++) {
        var wa = b.w[h];
        if (wa <= 0) continue;
        var A = r.arm[hands[h]];
        _c.addScaledVector(_t.subVectors(A.grip, A.tgt), wa);
        _d.addScaledVector(A.fdir, wa);
        cw += wa;
      }
      if (cw > 0) { b.grip.addScaledVector(_c, Math.min(1, cw) / cw); }
      b.down.copy(b.d0);
      if (b.BA > 0 && _d.lengthSq() > 1e-6) {
        _d.normalize();
        b.down.lerp(_d, b.BA);
        if (b.down.lengthSq() < 1e-6) b.down.copy(_d);
        b.down.normalize();
      }
      _x.copy(b.ah).addScaledVector(b.down, -b.ah.dot(b.down));
      if (_x.lengthSq() < 1e-6) { _x.set(0, 0, 1).applyQuaternion(b.fq); _x.addScaledVector(b.down, -_x.dot(b.down)); }
      _x.normalize();
      _y.copy(b.down).negate();
      _z.crossVectors(_x, _y);
      _m4.makeBasis(_x, _y, _z);
      b.obj.position.copy(b.grip);
      b.obj.quaternion.setFromRotationMatrix(_m4);
    }
    r.root.updateMatrixWorld(true);
    for (i = 0; i < 2; i++) this.bells[i].obj.updateMatrixWorld(true);
  };

  Stage.prototype.snapshot = function (snap) {
    snap = snap || { p: [], q: [] };
    for (var i = 0; i < this.blendNodes.length; i++) {
      var n = this.blendNodes[i];
      (snap.p[i] = snap.p[i] || new V3()).copy(n.position);
      (snap.q[i] = snap.q[i] || new Qt()).copy(n.quaternion);
    }
    return snap;
  };
  Stage.prototype.blendFrom = function (snap, w) {   // w = weight of the snapshot
    for (var i = 0; i < this.blendNodes.length; i++) {
      var n = this.blendNodes[i];
      n.position.lerp(snap.p[i], w);
      n.quaternion.slerp(snap.q[i], w);
    }
    this.rig.root.updateMatrixWorld(true);
    this.bells[0].obj.updateMatrixWorld(true);
    this.bells[1].obj.updateMatrixWorld(true);
  };

  Stage.prototype.updateShadows = function () {
    for (var i = 0; i < this.casters.length; i++) {
      var c = this.casters[i], m = c.mesh;
      if (!c.node.visible || (c.node.parent && !c.node.parent.visible)) { m.visible = false; continue; }
      _a.copy(c.off); c.node.localToWorld(_a);
      var h = Math.max(0, _a.y - c.r), f = clamp01(1 - h / c.fall);
      f = f * f;
      m.visible = f > 0.01;
      if (!m.visible) continue;
      var sz = c.r * 2.6 * (1 + h * 1.1);
      m.position.set(_a.x, 0.001 + i * 0.00004, _a.z);
      if (c.foot) {
        _b.set(0, 0, 1).transformDirection(c.node.matrixWorld);
        m.rotation.y = Math.atan2(_b.x, _b.z);
        var flat = Math.sqrt(_b.x * _b.x + _b.z * _b.z);
        m.scale.set(sz * 0.9, 1, sz * (1 + 1.5 * flat));
      } else {
        m.rotation.y = 0;
        m.scale.set(sz, 1, sz);
      }
      m.material.opacity = c.k * f;
    }
  };

  // bounding sphere of the current pose (for camera framing)
  Stage.prototype.collect = function (box) {
    var r = this.rig, me = this;
    function add(n, off, rad) {
      _a.set(off[0], off[1], off[2]); n.localToWorld(_a);
      box.expandByPoint(_b.copy(_a).addScalar(rad));
      box.expandByPoint(_b.copy(_a).addScalar(-rad));
    }
    add(r.head, [0, 0.1, 0], 0.13);
    add(r.pelvis, [0, 0, 0], 0.16);
    add(r.chest, [0, 0.08, 0], 0.18);
    ['L', 'R'].forEach(function (nm) {
      add(r.arm[nm].hand, [0, -0.05, 0], 0.07);
      add(r.arm[nm].fa, [0, 0, 0], 0.06);
      add(r.leg[nm].sh, [0, 0, 0], 0.07);
      add(r.leg[nm].ft, [0, -0.03, 0.07], 0.1);
    });
    this.bells.forEach(function (b) { if (b.obj.visible) add(b.obj, [0, -0.15, 0], 0.15); });
    box.expandByPoint(_b.set(box.min.x, 0, box.min.z));
    return box;
  };

  Stage.prototype.dispose = function () {
    var k;
    for (k in this.geos) this.geos[k].dispose();
    for (k in this.mats) this.mats[k].dispose();
    for (k in this.tex) this.tex[k].dispose();
    this.casters.forEach(function (c) { c.mesh.material.dispose(); });
    this.scene.clear && this.scene.clear();
  };

  function fitCamera(box, cam, az, el, out) {
    var c = box.getCenter(_a), s = box.getSize(_b);
    // radius of the box as seen from the camera azimuth (approximate)
    var horiz = Math.abs(Math.cos(az)) * s.x + Math.abs(Math.sin(az)) * s.z;
    var depth = Math.abs(Math.sin(az)) * s.x + Math.abs(Math.cos(az)) * s.z;
    var vfov = cam.fov * D2R, hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    var hh = s.y * Math.cos(el) + depth * Math.abs(Math.sin(el));
    var dv = (hh / 2) / Math.tan(vfov / 2), dh = (horiz / 2) / Math.tan(hfov / 2);
    out.dist = Math.max(dv, dh) * 1.04 + depth * 0.3;
    out.target = c.clone();
    return out;
  }

  function placeCamera(cam, target, dist, az, el) {
    cam.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
    cam.lookAt(target);
  }

  var RM = false;
  try { RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { RM = false; }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  /* ======================================================================
   * Viewer
   * ==================================================================== */
  function Viewer(container, opts) {
    var self = this;
    opts = opts || {};
    this.container = container;
    this.colors = mergeColors(DEF_COLORS, opts.colors);
    this.interactive = opts.interactive !== false;
    try { if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; } catch (e) { /* ignore */ }
    var renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var cv = this.canvas = renderer.domElement;
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;outline:none;' +
      '-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;touch-action:' + (this.interactive ? 'pan-y' : 'auto') + ';' +
      (this.interactive ? 'cursor:grab;' : '');
    cv.setAttribute('aria-hidden', 'true');
    container.appendChild(cv);
    this.stage = new Stage(this.colors);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    this.pose = newPose();
    this.box = new THREE.Box3();
    this.t = 0; this.speed = 1; this.paused = RM; this.double = false;
    this.key = null; this.def = null;
    this.blend = null; this.snap = null;
    this.az0 = -35 * D2R; this.el0 = 10 * D2R; this.az = this.az0; this.el = this.el0; this.zoom = 1;
    this.target = new V3(0, 0.95, 0); this.goalTarget = new V3(0, 0.95, 0); this.dist = 6; this.goalDist = 6;
    this.lastInteract = -1e9; this.pointers = {}; this.npointers = 0;
    this.visible = true; this.disposed = false; this.raf = 0; this.last = 0; this.firstFrame = true;
    this.applyBg();
    this._loop = function (ts) { self.frame(ts); };

    this._listeners = [];
    var on = function (el, ev, fn, o) { el.addEventListener(ev, fn, o || false); self._listeners.push([el, ev, fn, o || false]); };
    on(document, 'visibilitychange', function () { self.kick(); });
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(container);
    } else on(window, 'resize', function () { self.resize(); });
    if (window.IntersectionObserver) {
      this._io = new IntersectionObserver(function (entries) {
        self.visible = entries[entries.length - 1].isIntersecting;
        self.kick();
      });
      this._io.observe(cv);
    }
    if (this.interactive) this.bindPointer(on);
    this.resize();
    this.play(opts.anim || ANIMS[0], {});
    this._initial = true;   // the page's first play() is not a user "play" tap (matters for reduced motion)
  }

  Viewer.prototype.applyBg = function () {
    var bg = this.colors.bg;
    if (bg) { var c = new THREE.Color(bg); this.renderer.setClearColor(c, 1); }
    else this.renderer.setClearColor(0x000000, 0);
  };

  Viewer.prototype.bindPointer = function (on) {
    var self = this, cv = this.canvas, pinch = null;
    function pts() { var a = []; for (var k in self.pointers) a.push(self.pointers[k]); return a; }
    on(cv, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      self.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      self.npointers = Object.keys(self.pointers).length;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (self.npointers === 2) { var a = pts(); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, z: self.zoom }; }
      self.dragging = true; cv.style.cursor = 'grabbing';
      self.lastInteract = now();
      self.kick();
    });
    on(cv, 'pointermove', function (e) {
      var pt = self.pointers[e.pointerId];
      if (!pt) return;
      var dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX; pt.y = e.clientY;
      if (self.npointers >= 2 && pinch) {
        var a = pts(), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        self.zoom = clamp(pinch.z * pinch.d / d, 0.55, 1.8);
      } else {
        var w = cv.clientWidth || 300;
        self.az -= dx * (5.5 / w);
        self.el = clamp(self.el + dy * (2.5 / w), -0.08, 0.95);
      }
      self.lastInteract = now();
      self.kick();
    });
    var up = function (e) {
      if (!self.pointers[e.pointerId]) return;
      delete self.pointers[e.pointerId];
      self.npointers = Object.keys(self.pointers).length;
      if (self.npointers < 2) pinch = null;
      if (self.npointers === 0) { self.dragging = false; cv.style.cursor = 'grab'; }
      self.lastInteract = now();
      self.kick();
    };
    on(cv, 'pointerup', up); on(cv, 'pointercancel', up); on(cv, 'lostpointercapture', up);
    on(cv, 'wheel', function (e) {
      if (!e.ctrlKey) return;    // plain wheel scrolls the page; ctrl/pinch-trackpad zooms
      e.preventDefault();
      self.zoom = clamp(self.zoom * Math.exp(e.deltaY * 0.01), 0.55, 1.8);
      self.lastInteract = now();
      self.kick();
    }, { passive: false });
    on(cv, 'dblclick', function () { self.resetView(); });
  };

  Viewer.prototype.resize = function () {
    if (this.disposed) return;
    var w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.def) this.refit(true);
    this.kick();
  };

  Viewer.prototype.refit = function (keepTarget) {
    var d = this.def, box = this.box.makeEmpty(), n = d.proc ? 6 : 16;
    for (var i = 0; i < n; i++) {
      evalAnim(d, i / n, this.pose);
      this.stage.applyPose(this.pose, d, this.double);
      this.stage.collect(box);
    }
    var f = fitCamera(box, this.camera, d.az * D2R, d.el * D2R, {});
    this.goalTarget.copy(f.target); this.goalDist = f.dist;
    if (this.firstFrame && !keepTarget) { this.target.copy(f.target); this.dist = f.dist; }
  };

  Viewer.prototype.play = function (key, o) {
    if (this.disposed) return;
    o = o || {};
    var d = DEFS[key];
    if (!d) { if (window.console) console.warn('[KB3D] unknown animation "' + key + '"'); d = DEFS[ANIMS[0]]; key = ANIMS[0]; }
    var same = key === this.key && !this._initial, dbl = !!o.double;
    this._initial = false;
    if (this.def && !this.firstFrame && (!same || dbl !== this.double)) {
      this.snap = this.stage.snapshot(this.snap);
      this.blend = { t0: now(), dur: 280 };
    }
    if (o.speed !== undefined && isFinite(o.speed)) this.speed = clamp(+o.speed, 0.05, 4);
    if (RM) {
      if (same && this.paused) this.paused = false;
      else if (!same) { this.paused = true; this.t = d.thumb * d.dur; }
    } else {
      this.paused = false;
      if (!same) this.t = 0;
    }
    this.key = key; this.def = d; this.double = dbl;
    this.az0 = d.az * D2R; this.el0 = d.el * D2R;
    if (this.firstFrame) { this.az = this.az0; this.el = this.el0; }
    else if (!same && now() - this.lastInteract > 1500) this.lastInteract = -1e9;
    this.refit(false);
    this.kick();
  };
  Viewer.prototype.setSpeed = function (x) { if (isFinite(x)) this.speed = clamp(+x, 0.05, 4); };
  Viewer.prototype.pause = function () { this.paused = true; this.kick(); };
  Viewer.prototype.resume = function () { this.paused = false; this.kick(); };
  Viewer.prototype.isPaused = function () { return !!this.paused; };
  Viewer.prototype.setColors = function (c) {
    if (this.disposed || !c) return;
    this.colors = mergeColors(this.colors, c);
    this.stage.setColors(this.colors);
    this.applyBg();
    this.kick();
  };
  Viewer.prototype.resetView = function () { this.lastInteract = -1e9; this.kick(); };

  Viewer.prototype.kick = function () {
    if (this.disposed || this.raf) return;
    if (!this.visible || document.hidden) return;
    this.raf = requestAnimationFrame(this._loop);
  };

  Viewer.prototype.frame = function (ts) {
    this.raf = 0;
    if (this.disposed || !this.visible || document.hidden) return;
    var dt = this.last ? Math.min(0.05, Math.max(0, (ts - this.last) / 1000)) : 0;
    this.last = ts;
    var d = this.def, active = false;
    if (!this.paused) { this.t += dt * this.speed; active = true; }
    evalAnim(d, this.t / d.dur, this.pose);
    this.stage.applyPose(this.pose, d, this.double);
    if (this.blend) {
      var k = (now() - this.blend.t0) / this.blend.dur;
      if (k >= 1) this.blend = null;
      else { this.stage.blendFrom(this.snap, 1 - smooth(k)); active = true; }
    }
    this.stage.updateShadows();
    // camera
    var idle = !this.dragging && (now() - this.lastInteract > 3500);
    if (idle) {
      var ka = 1 - Math.exp(-dt * 2.2);
      var da = this.az0 - this.az;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 1e-4 || Math.abs(this.el0 - this.el) > 1e-4 || Math.abs(1 - this.zoom) > 1e-4) {
        this.az += da * ka; this.el += (this.el0 - this.el) * ka; this.zoom += (1 - this.zoom) * ka; active = true;
      } else { this.az = this.az0; this.el = this.el0; this.zoom = 1; }
    } else if (this.dragging) active = true;
    else active = true;  // waiting for the idle timeout
    var kt = this.firstFrame ? 1 : 1 - Math.exp(-dt * 4);
    if (this.target.distanceToSquared(this.goalTarget) > 1e-7 || Math.abs(this.dist - this.goalDist) > 1e-4) {
      this.target.lerp(this.goalTarget, kt); this.dist += (this.goalDist - this.dist) * kt; active = true;
    }
    placeCamera(this.camera, this.target, this.dist * this.zoom, this.az, this.el);
    this.stage.lightRig.rotation.y = this.az;
    this.renderer.render(this.stage.scene, this.camera);
    this.firstFrame = false;
    if (active) this.kick(); else this.last = 0;
  };

  // test/debug helper: freeze at loop phase u (0..1) and render immediately
  Viewer.prototype.seek = function (u, az, el) {
    this.paused = true; this.blend = null;
    this.t = u * this.def.dur;
    this.target.copy(this.goalTarget); this.dist = this.goalDist;
    this.az = az === undefined ? this.az0 : az * D2R; this.el = el === undefined ? this.el0 : el * D2R; this.zoom = 1;
    this.lastInteract = az === undefined ? -1e9 : now() + 1e9;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.last = 0; this.frame(now());
  };

  Viewer.prototype.dispose = function () {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this._listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    this._listeners = [];
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    this.stage.dispose();
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  function publicViewer(v) {
    var pub = {
      play: function (key, o) { v.play(key, o); },
      setSpeed: function (x) { v.setSpeed(x); },
      pause: function () { v.pause(); },
      resume: function () { v.resume(); },
      isPaused: function () { return v.isPaused(); },
      setColors: function (c) { v.setColors(c); },
      resetView: function () { v.resetView(); },
      dispose: function () { v.dispose(); }
    };
    // test hook (non-enumerable): freeze at loop phase u, optional camera azimuth/elevation in degrees
    try { Object.defineProperty(pub, '_seek', { value: function (u, az, el) { v.seek(u, az, el); } }); } catch (e) { /* ignore */ }
    return pub;
  }

  /* ======================================================================
   * Thumbnails: one shared offscreen renderer + stage
   * ==================================================================== */
  var TH = null, thQueue = Promise.resolve();
  function thumbCtx() {
    if (TH) return TH;
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    var stage = new Stage(DEF_COLORS);
    stage.noFloor = true;
    TH = { renderer: renderer, stage: stage, camera: new THREE.PerspectiveCamera(30, 1, 0.05, 60), pose: newPose(), box: new THREE.Box3() };
    renderer.domElement.addEventListener('webglcontextlost', function () { TH = null; }, false);
    return TH;
  }
  function renderThumb(key, o) {
    var d = DEFS[key];
    if (!d) return null;
    var ctx = thumbCtx(), size = Math.max(16, Math.round(o.size || 160));
    var px = Math.round(size * Math.min(window.devicePixelRatio || 1, 2));
    ctx.renderer.setSize(px, px, false);
    ctx.stage.setColors(mergeColors(DEF_COLORS, o.colors));
    var dbl = !!o.double;
    evalAnim(d, d.thumb, ctx.pose);
    ctx.stage.applyPose(ctx.pose, d, dbl);
    ctx.stage.updateShadows();
    ctx.camera.aspect = 1; ctx.camera.updateProjectionMatrix();
    var box = ctx.stage.collect(ctx.box.makeEmpty());
    var az = d.az * D2R, el = Math.max(d.el, 8) * D2R;
    var f = fitCamera(box, ctx.camera, az, el, {});
    placeCamera(ctx.camera, f.target, f.dist * 0.97, az, el);
    ctx.stage.lightRig.rotation.y = az;
    ctx.renderer.render(ctx.stage.scene, ctx.camera);
    return ctx.renderer.domElement.toDataURL('image/png');
  }
  function thumbnail(key, o) {
    o = o || {};
    if (!hasWebGL()) return Promise.resolve(null);
    var p = thQueue.then(function () {
      return new Promise(function (res) {
        setTimeout(function () {
          try { res(renderThumb(key, o)); } catch (e) { if (window.console) console.warn('[KB3D] thumbnail failed', e); res(null); }
        }, 0);
      });
    });
    thQueue = p.then(noop, noop);
    return p;
  }

  window.KB3D = {
    ANIMS: ANIMS.slice(),
    create: function (container, opts) {
      if (!container) throw new Error('KB3D.create: container required');
      if (!hasWebGL()) return fallbackViewer(container);
      try { return publicViewer(new Viewer(container, opts)); } catch (e) {
        if (window.console) console.warn('[KB3D] WebGL init failed', e);
        return fallbackViewer(container);
      }
    },
    thumbnail: thumbnail
  };
  // non-enumerable internals for tests/debugging
  try {
    Object.defineProperty(window.KB3D, '_defs', { value: DEFS });
    Object.defineProperty(window.KB3D, '_eval', { value: function (key, u) { return evalAnim(DEFS[key], u, newPose()); } });
    Object.defineProperty(window.KB3D, '_Stage', { value: Stage });
  } catch (e) { /* ignore */ }
})();

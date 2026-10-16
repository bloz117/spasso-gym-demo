/**
 * Fondos animados del portal (Aurora, Floating Lines, Lightfall, Grainient)
 * — port a WebGL2 puro, sin OGL/React/three.js, siguiendo el mismo enfoque
 * que ya usa recepcion.html para su fondo global "GhostFibers" (ver ese
 * archivo, bloque "FONDO ANIMADO GLOBAL"): los 4 componentes que pasó
 * Veimar (de reactbits.dev) usan React + OGL o React + three.js para montar
 * un triángulo/plano de pantalla completa con un fragment shader; como este
 * portal no tiene bundler ni esas librerías, se reimplementa acá con la API
 * nativa de WebGL2 — los fragment shaders son los mismos (así se ven igual
 * de bien), solo cambia cómo se compilan/montan y se les pasan los uniforms.
 *
 * Uso (ver también __establecerFondoPagina en funciones.js):
 *   const fondo = crearFondoAnimado('aurora', canvasEl, { colores: ['#7cff67','#B497CF','#5227FF'] });
 *   fondo.iniciar();
 *   fondo.actualizar({ estatico: true });   // congela en el cuadro actual
 *   fondo.detener();
 */
(function () {

  function compilarPrograma(gl, vertexSrc, fragmentSrc, etiqueta) {
    function compilar(tipo, fuente) {
      const shader = gl.createShader(tipo);
      gl.shaderSource(shader, fuente);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`[fondosAnimados:${etiqueta}] Error de shader:`, gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }
    const vs = compilar(gl.VERTEX_SHADER, vertexSrc);
    const fs = compilar(gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`[fondosAnimados:${etiqueta}] Error al enlazar programa:`, gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function hexARgb(hex) {
    const limpio = (hex || '#ffffff').toString().trim().replace('#', '').padEnd(6, '0').slice(0, 6);
    const num = parseInt(limpio, 16) || 0xffffff;
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  // Rellena/recorta un array de colores hex a exactamente `n` colores RGB
  // (repitiendo el último si faltan) — se usa para los uniforms tipo
  // vec3[N] de cada shader sin tener que preocuparse por cuántos mandó el
  // que llama.
  function coloresAPlano(hexs, n) {
    const base = (hexs && hexs.length ? hexs : ['#ffffff']);
    const plano = [];
    for (let i = 0; i < n; i++) {
      const c = hexARgb(base[Math.min(i, base.length - 1)]);
      plano.push(c[0], c[1], c[2]);
    }
    return plano;
  }

  const VERT_SIMPLE = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const VERT_UV = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  // ==================== AURORA ====================
  // Shader tal cual lo pasó Veimar (ya venía en formato WebGL2/#version 300 es,
  // así que no necesitó conversión de sintaxis, solo el montaje).
  const FRAG_AURORA = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \\
  int index = 0;                                            \\
  for (int i = 0; i < 2; i++) {                               \\
     ColorStop currentColor = colors[i];                    \\
     bool isInBetween = currentColor.position <= factor;    \\
     index = int(mix(float(index), float(i), float(isInBetween))); \\
  }                                                         \\
  ColorStop currentColor = colors[index];                   \\
  ColorStop nextColor = colors[index + 1];                  \\
  float range = nextColor.position - currentColor.position; \\
  float lerpFactor = (factor - currentColor.position) / range; \\
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \\
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  if (uLightMode > 0.5) {
    float energy = clamp(max(intensity, 0.0), 0.0, 1.0);
    float coverage = clamp(auroraAlpha * (0.55 + 0.45 * energy), 0.0, 0.86);
    vec3 chroma = pow(clamp(rampColor, 0.0, 1.0), vec3(1.2));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 0.0001);
    fragColor = vec4(mix(vec3(1.0), chroma, min(coverage * 1.08, 0.94)), 1.0);
  } else {
    fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
  }
}
`;

  // ==================== FLOATING LINES ====================
  // Original: three.js ShaderMaterial (vertex trivial con projectionMatrix/
  // modelViewMatrix que three.js inyecta solo). Portado: vertex propio que
  // manda directo a clip-space, igual que los otros 3. El fragment no
  // depende de ningún varying (usa gl_FragCoord.xy directo vía mainImage),
  // así que no hace falta el atributo 'uv'.
  const FRAG_FLOATING_LINES = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform float animationSpeed;

uniform bool enableTop;
uniform bool enableMiddle;
uniform bool enableBottom;

uniform int topLineCount;
uniform int middleLineCount;
uniform int bottomLineCount;

uniform float topLineDistance;
uniform float middleLineDistance;
uniform float bottomLineDistance;

uniform vec3 topWavePosition;
uniform vec3 middleWavePosition;
uniform vec3 bottomWavePosition;

uniform vec2 iMouse;
uniform bool interactive;
uniform float bendRadius;
uniform float bendStrength;
uniform float bendInfluence;

uniform bool parallax;
uniform float parallaxStrength;
uniform vec2 parallaxOffset;

uniform vec3 lineGradient[8];
uniform int lineGradientCount;
uniform vec3 backgroundColor;
uniform bool lightMode;

out vec4 fragColor;

const vec3 BLACK = vec3(0.0);
const vec3 PINK  = vec3(233.0, 71.0, 245.0) / 255.0;
const vec3 BLUE  = vec3(47.0,  75.0, 162.0) / 255.0;

mat2 rotate(float r) {
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

vec3 background_color(vec2 uv) {
  vec3 col = vec3(0.0);

  float y = sin(uv.x - 0.2) * 0.3 - 0.1;
  float m = uv.y - y;

  col += mix(BLUE, BLACK, smoothstep(0.0, 1.0, abs(m)));
  col += mix(PINK, BLACK, smoothstep(0.0, 1.0, abs(m - 0.8)));
  return col * 0.5;
}

vec3 getLineColor(float t, vec3 baseColor) {
  if (lineGradientCount <= 0) {
    return baseColor;
  }

  vec3 gradientColor;

  if (lineGradientCount == 1) {
    gradientColor = lineGradient[0];
  } else {
    float clampedT = clamp(t, 0.0, 0.9999);
    float scaled = clampedT * float(lineGradientCount - 1);
    int idx = int(floor(scaled));
    float f = fract(scaled);
    int idx2 = min(idx + 1, lineGradientCount - 1);

    vec3 c1 = lineGradient[idx];
    vec3 c2 = lineGradient[idx2];

    gradientColor = mix(c1, c2, f);
  }

  return gradientColor * 0.5;
}

float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
  float time = iTime * animationSpeed;

  float x_offset   = offset;
  float x_movement = time * 0.1;
  float amp        = sin(offset + time * 0.2) * 0.3;
  float y          = sin(uv.x + x_offset + x_movement) * amp;

  if (shouldBend) {
    vec2 d = screenUv - mouseUv;
    float influence = exp(-dot(d, d) * bendRadius);
    float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
    y += bendOffset;
  }

  float m = uv.y - y;
  return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
}

void mainImage(out vec4 fragColorOut, in vec2 fragCoord) {
  vec2 baseUv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;

  if (parallax) {
    baseUv += parallaxOffset;
  }

  vec3 col = vec3(0.0);

  vec3 b = lineGradientCount > 0 ? vec3(0.0) : background_color(baseUv);

  vec2 mouseUv = vec2(0.0);
  if (interactive) {
    mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
    mouseUv.y *= -1.0;
  }

  if (enableBottom) {
    for (int i = 0; i < bottomLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(bottomLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);

      float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
        1.5 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.2;
    }
  }

  if (enableMiddle) {
    for (int i = 0; i < middleLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(middleLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);

      float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
        2.0 + 0.15 * fi,
        baseUv,
        mouseUv,
        interactive
      );
    }
  }

  if (enableTop) {
    for (int i = 0; i < topLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(topLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);

      float angle = topWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      ruv.x *= -1.0;
      col += lineCol * wave(
        ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
        1.0 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.1;
    }
  }

  if (lightMode) {
    vec3 energy = max(col, vec3(0.0));
    float peak = max(energy.r, max(energy.g, energy.b));
    float coverage = smoothstep(0.018, 0.5, peak);
    vec3 chroma = clamp(energy / max(peak, 0.0001), 0.0, 1.0);
    chroma = pow(chroma, vec3(1.35));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 0.0001);
    vec3 ink = mix(chroma, clamp(chroma * 0.82, 0.0, 1.0), smoothstep(0.5, 1.0, coverage));
    fragColorOut = vec4(mix(vec3(1.0), ink, coverage * 0.94), 1.0);
  } else {
    fragColorOut = vec4(col, 1.0);
  }
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  fragColor = color;
}
`;

  // ==================== LIGHTFALL ====================
  // Original: OGL con atributos 'position' + 'uv' propios (no three.js), y
  // el fragment reconstruye fragCoord como vUv * iResolution.xy — a
  // diferencia de Floating Lines, este SÍ necesita el atributo 'uv'.
  const FRAG_LIGHTFALL = `#version 300 es
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uBgColor;
uniform vec3  uMouseColor;
uniform float uSpeed;
uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform float uLightMode;

in vec2 vUv;
out vec4 fragColor;

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

vec2 sceneC(vec2 frag, vec2 r) {
  vec2 P = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (d <= 1e-4) break;
    O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = 0.1 * iTime * uSpeed + 9.0;
  float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, 6.28318530718 / angRings);

  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
  dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  vec2 P = vec2(2.0, 1.0) * uv0 - (r / r.x) * vec2(0.0, 1.0);
  vec4 O = uLightMode > 0.5
    ? vec4(0.0)
    : vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mN = (iMouse + iMouse - r) / r.x;
    float md = length(uv0 - mN);
    mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    O.rgb += uMouseColor * mGlow * 0.25;
  }

  float zr = 5e-4 * uStreakWidth;
  vec2 rr = vec2(max(length(fw), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    weight *= (1.0 + mGlow * 2.0);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
    C.x += Y.x / 8.0;
  }

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  if (uLightMode > 0.5) {
    float peak = max(colr.r, max(colr.g, colr.b));
    float coverage = smoothstep(0.035, 0.58, peak) * uOpacity;
    vec3 chroma = clamp(colr / max(peak, 1e-4), 0.0, 1.0);
    chroma = pow(chroma, vec3(1.35));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 1e-4);
    o = vec4(mix(vec3(1.0), chroma, coverage * 0.94), 1.0);
  } else {
    o = vec4(colr, uOpacity);
  }
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  fragColor = color;
}
`;

  // ==================== GRAINIENT ====================
  // Ya venía en #version 300 es (OGL con vertex trivial), casi sin cambios.
  const FRAG_GRAINIENT = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uLightMode;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);
  if(uLightMode>0.5){
    float energy=max(max(col.r,col.g),col.b);
    vec3 hue=col/max(energy,0.001);
    float chroma=length(col-vec3(dot(col,vec3(0.333333))));
    float coverage=clamp(0.12+chroma*1.15+energy*0.18,0.0,0.88);
    col=mix(vec3(1.0),clamp(hue*0.58+col*0.18,0.0,1.0),coverage);
  }

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

  // ==================== DEFINICIONES POR TIPO ====================
  // Cada entrada sabe: qué vertex/fragment usar, si necesita el atributo
  // 'uv' además de 'position', y cómo crear/actualizar sus propios uniforms
  // a partir de las `opciones` que mande quien llama a crearFondoAnimado().
  const DEFINICIONES = {
    aurora: {
      vertex: VERT_SIMPLE,
      fragment: FRAG_AURORA,
      necesitaUv: false,
      crearUniforms(gl, p) {
        return {
          uTime: gl.getUniformLocation(p, 'uTime'),
          uAmplitude: gl.getUniformLocation(p, 'uAmplitude'),
          uColorStops: gl.getUniformLocation(p, 'uColorStops'),
          uResolution: gl.getUniformLocation(p, 'uResolution'),
          uBlend: gl.getUniformLocation(p, 'uBlend'),
          uLightMode: gl.getUniformLocation(p, 'uLightMode')
        };
      },
      actualizarUniforms(gl, u, canvas, t, o) {
        gl.uniform1f(u.uTime, t);
        gl.uniform1f(u.uAmplitude, o.amplitude ?? 1.0);
        gl.uniform2f(u.uResolution, canvas.width, canvas.height);
        gl.uniform1f(u.uBlend, o.blend ?? 0.5);
        gl.uniform1f(u.uLightMode, o.lightMode ? 1 : 0);
        gl.uniform3fv(u.uColorStops, new Float32Array(coloresAPlano(o.colores || ['#5227FF', '#7cff67', '#5227FF'], 3)));
      }
    },

    'floating-lines': {
      vertex: VERT_SIMPLE,
      fragment: FRAG_FLOATING_LINES,
      necesitaUv: false,
      crearUniforms(gl, p) {
        const nombres = [
          'iTime', 'iResolution', 'animationSpeed', 'enableTop', 'enableMiddle', 'enableBottom',
          'topLineCount', 'middleLineCount', 'bottomLineCount',
          'topLineDistance', 'middleLineDistance', 'bottomLineDistance',
          'topWavePosition', 'middleWavePosition', 'bottomWavePosition',
          'iMouse', 'interactive', 'bendRadius', 'bendStrength', 'bendInfluence',
          'parallax', 'parallaxStrength', 'parallaxOffset',
          'lineGradient', 'lineGradientCount', 'backgroundColor', 'lightMode'
        ];
        const u = {};
        nombres.forEach(n => { u[n] = gl.getUniformLocation(p, n); });
        return u;
      },
      actualizarUniforms(gl, u, canvas, t, o) {
        const colores = o.colores && o.colores.length ? o.colores : ['#e945f5', '#6f6f6f', '#6a6a6a'];
        const lineCount = o.lineCount ?? 8;
        const lineDistance = (o.lineDistance ?? 8) * 0.01;
        gl.uniform1f(u.iTime, t);
        gl.uniform3f(u.iResolution, canvas.width, canvas.height, 1);
        gl.uniform1f(u.animationSpeed, o.animationSpeed ?? 1);
        gl.uniform1i(u.enableTop, 1);
        gl.uniform1i(u.enableMiddle, 1);
        gl.uniform1i(u.enableBottom, 1);
        gl.uniform1i(u.topLineCount, lineCount);
        gl.uniform1i(u.middleLineCount, lineCount);
        gl.uniform1i(u.bottomLineCount, lineCount);
        gl.uniform1f(u.topLineDistance, lineDistance);
        gl.uniform1f(u.middleLineDistance, lineDistance);
        gl.uniform1f(u.bottomLineDistance, lineDistance);
        gl.uniform3f(u.topWavePosition, 10.0, 0.5, -0.4);
        gl.uniform3f(u.middleWavePosition, 5.0, 0.0, 0.2);
        gl.uniform3f(u.bottomWavePosition, 2.0, -0.7, -1.0);
        gl.uniform2f(u.iMouse, -1000, -1000);
        gl.uniform1i(u.interactive, 0);
        gl.uniform1f(u.bendRadius, o.bendRadius ?? 8);
        gl.uniform1f(u.bendStrength, o.bendStrength ?? -2);
        gl.uniform1f(u.bendInfluence, 0);
        gl.uniform1i(u.parallax, 0);
        gl.uniform1f(u.parallaxStrength, 0.2);
        gl.uniform2f(u.parallaxOffset, 0, 0);
        gl.uniform3fv(u.lineGradient, new Float32Array(coloresAPlano(colores, 8)));
        gl.uniform1i(u.lineGradientCount, Math.min(colores.length, 8));
        gl.uniform3f(u.backgroundColor, 0, 0, 0);
        gl.uniform1i(u.lightMode, o.lightMode ? 1 : 0);
      }
    },

    lightfall: {
      vertex: VERT_UV,
      fragment: FRAG_LIGHTFALL,
      necesitaUv: true,
      crearUniforms(gl, p) {
        const nombres = [
          'iResolution', 'iMouse', 'iTime',
          'uColor0', 'uColor1', 'uColor2', 'uColor3', 'uColor4', 'uColor5', 'uColor6', 'uColor7', 'uColorCount',
          'uBgColor', 'uMouseColor', 'uSpeed', 'uStreakCount', 'uStreakWidth', 'uStreakLength',
          'uGlow', 'uDensity', 'uTwinkle', 'uZoom', 'uBgGlow', 'uOpacity',
          'uMouseEnabled', 'uMouseStrength', 'uMouseRadius', 'uLightMode'
        ];
        const u = {};
        nombres.forEach(n => { u[n] = gl.getUniformLocation(p, n); });
        return u;
      },
      actualizarUniforms(gl, u, canvas, t, o) {
        const colores = o.colores && o.colores.length ? o.colores : ['#A6C8FF', '#5227FF', '#FF9FFC'];
        const plano = coloresAPlano(colores, 8);
        const nombresColor = ['uColor0', 'uColor1', 'uColor2', 'uColor3', 'uColor4', 'uColor5', 'uColor6', 'uColor7'];
        nombresColor.forEach((n, i) => gl.uniform3f(u[n], plano[i * 3], plano[i * 3 + 1], plano[i * 3 + 2]));
        gl.uniform1i(u.uColorCount, Math.min(colores.length, 8));
        gl.uniform3f(u.iResolution, canvas.width, canvas.height, 1);
        gl.uniform2f(u.iMouse, 0, 0);
        gl.uniform1f(u.iTime, t);
        gl.uniform3fv(u.uBgColor, new Float32Array(hexARgb(o.backgroundColor || '#0A29FF')));
        // Promedio de los colores, igual que hace el demo original para
        // "uMouseColor" — se usa como acento cuando hay interacción, que
        // acá dejamos apagada por defecto (uMouseEnabled=0).
        const avg = [0, 0, 0];
        const rgbList = colores.map(hexARgb);
        rgbList.forEach(c => { avg[0] += c[0]; avg[1] += c[1]; avg[2] += c[2]; });
        avg[0] /= rgbList.length; avg[1] /= rgbList.length; avg[2] /= rgbList.length;
        gl.uniform3f(u.uMouseColor, avg[0], avg[1], avg[2]);
        gl.uniform1f(u.uSpeed, o.speed ?? 0.5);
        gl.uniform1i(u.uStreakCount, Math.max(1, Math.min(16, Math.round(o.streakCount ?? 2))));
        gl.uniform1f(u.uStreakWidth, o.streakWidth ?? 1);
        gl.uniform1f(u.uStreakLength, o.streakLength ?? 1);
        gl.uniform1f(u.uGlow, o.glow ?? 1);
        gl.uniform1f(u.uDensity, o.density ?? 0.6);
        gl.uniform1f(u.uTwinkle, o.twinkle ?? 1);
        gl.uniform1f(u.uZoom, o.zoom ?? 3);
        gl.uniform1f(u.uBgGlow, o.backgroundGlow ?? 0.5);
        gl.uniform1f(u.uOpacity, o.opacity ?? 1);
        gl.uniform1f(u.uMouseEnabled, 0);
        gl.uniform1f(u.uMouseStrength, o.mouseStrength ?? 0.5);
        gl.uniform1f(u.uMouseRadius, o.mouseRadius ?? 1);
        gl.uniform1f(u.uLightMode, o.lightMode ? 1 : 0);
      }
    },

    grainient: {
      vertex: VERT_SIMPLE,
      fragment: FRAG_GRAINIENT,
      necesitaUv: false,
      crearUniforms(gl, p) {
        const nombres = [
          'iResolution', 'iTime', 'uTimeSpeed', 'uColorBalance', 'uWarpStrength', 'uWarpFrequency',
          'uWarpSpeed', 'uWarpAmplitude', 'uBlendAngle', 'uBlendSoftness', 'uRotationAmount',
          'uNoiseScale', 'uGrainAmount', 'uGrainScale', 'uGrainAnimated', 'uContrast', 'uGamma',
          'uSaturation', 'uCenterOffset', 'uZoom', 'uColor1', 'uColor2', 'uColor3', 'uLightMode'
        ];
        const u = {};
        nombres.forEach(n => { u[n] = gl.getUniformLocation(p, n); });
        return u;
      },
      actualizarUniforms(gl, u, canvas, t, o) {
        const colores = o.colores && o.colores.length ? o.colores : ['#FF9FFC', '#5227FF', '#B497CF'];
        gl.uniform2f(u.iResolution, canvas.width, canvas.height);
        gl.uniform1f(u.iTime, t);
        gl.uniform1f(u.uTimeSpeed, o.timeSpeed ?? 0.25);
        gl.uniform1f(u.uColorBalance, o.colorBalance ?? 0);
        gl.uniform1f(u.uWarpStrength, o.warpStrength ?? 1);
        gl.uniform1f(u.uWarpFrequency, o.warpFrequency ?? 5);
        gl.uniform1f(u.uWarpSpeed, o.warpSpeed ?? 2);
        gl.uniform1f(u.uWarpAmplitude, o.warpAmplitude ?? 50);
        gl.uniform1f(u.uBlendAngle, o.blendAngle ?? 0);
        gl.uniform1f(u.uBlendSoftness, o.blendSoftness ?? 0.05);
        gl.uniform1f(u.uRotationAmount, o.rotationAmount ?? 500);
        gl.uniform1f(u.uNoiseScale, o.noiseScale ?? 2);
        gl.uniform1f(u.uGrainAmount, o.grainAmount ?? 0.1);
        gl.uniform1f(u.uGrainScale, o.grainScale ?? 2);
        gl.uniform1f(u.uGrainAnimated, o.grainAnimated ? 1 : 0);
        gl.uniform1f(u.uContrast, o.contrast ?? 1.5);
        gl.uniform1f(u.uGamma, o.gamma ?? 1);
        gl.uniform1f(u.uSaturation, o.saturation ?? 1);
        gl.uniform2f(u.uCenterOffset, o.centerX ?? 0, o.centerY ?? 0);
        gl.uniform1f(u.uZoom, o.zoom ?? 0.9);
        const c1 = hexARgb(colores[0]); const c2 = hexARgb(colores[1] || colores[0]); const c3 = hexARgb(colores[2] || colores[0]);
        gl.uniform3f(u.uColor1, c1[0], c1[1], c1[2]);
        gl.uniform3f(u.uColor2, c2[0], c2[1], c2[2]);
        gl.uniform3f(u.uColor3, c3[0], c3[1], c3[2]);
        gl.uniform1f(u.uLightMode, o.lightMode ? 1 : 0);
      }
    }
  };

  function crearFondoAnimado(tipo, canvas, opciones) {
    const NULO = { soportado: false, iniciar() {}, detener() {}, actualizar() {}, destruir() {} };
    const def = DEFINICIONES[tipo];
    if (!def) {
      console.warn('[fondosAnimados] Tipo de fondo desconocido:', tipo);
      return NULO;
    }

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) {
      console.warn('[fondosAnimados] WebGL2 no disponible en este navegador.');
      return NULO;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const program = compilarPrograma(gl, def.vertex, def.fragment, tipo);
    if (!program) return NULO;
    gl.useProgram(program);

    // Triángulo de pantalla completa (mismo truco que Triangle de OGL / el
    // fondo GhostFibers de recepcion.html). Cuando el shader necesita 'uv'
    // (Lightfall), se agrega un segundo atributo con el mismo truco que usa
    // OGL: uv en (0,0)/(2,0)/(0,2) para que la zona realmente visible
    // (-1..1 en position) mapee a uv 0..1 — el resto del triángulo se pasa
    // del viewport y no importa que su uv exceda 1.
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    if (def.necesitaUv) {
      const uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
      const uvLoc = gl.getAttribLocation(program, 'uv');
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
    }

    const u = def.crearUniforms(gl, program);
    let config = Object.assign({}, opciones || {});

    function ajustarTamano() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ancho = canvas.clientWidth || canvas.offsetWidth || 1;
      const alto = canvas.clientHeight || canvas.offsetHeight || 1;
      canvas.width = Math.max(1, Math.floor(ancho * dpr));
      canvas.height = Math.max(1, Math.floor(alto * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    let tActual = 0;
    function dibujarCuadro() {
      def.actualizarUniforms(gl, u, canvas, tActual, config);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { ajustarTamano(); dibujarCuadro(); })
      : null;
    if (resizeObserver) resizeObserver.observe(canvas);
    window.addEventListener('resize', ajustarTamano);

    const inicio = performance.now();
    let cuadroId = 0;
    let corriendo = false;

    function cuadro(ahora) {
      tActual = (ahora - inicio) / 1000;
      dibujarCuadro();
      if (corriendo && !config.estatico) {
        cuadroId = requestAnimationFrame(cuadro);
      }
    }

    return {
      soportado: true,
      iniciar() {
        if (corriendo) return;
        corriendo = true;
        ajustarTamano();
        if (config.estatico) {
          dibujarCuadro();
        } else {
          cuadroId = requestAnimationFrame(cuadro);
        }
      },
      detener() {
        corriendo = false;
        cancelAnimationFrame(cuadroId);
      },
      actualizar(nuevaConfig) {
        config = Object.assign({}, config, nuevaConfig || {});
        if (config.estatico) {
          // Se congela: se pinta un último cuadro fijo y no se programa
          // ningún requestAnimationFrame más hasta que se vuelva a activar
          // el movimiento.
          cancelAnimationFrame(cuadroId);
          dibujarCuadro();
        } else if (corriendo && !cuadroId) {
          cuadroId = requestAnimationFrame(cuadro);
        }
      },
      destruir() {
        this.detener();
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener('resize', ajustarTamano);
      }
    };
  }

  window.crearFondoAnimado = crearFondoAnimado;
})();

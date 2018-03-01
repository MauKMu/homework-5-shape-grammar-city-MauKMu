#version 300 es

//This is a vertex shader. While it is called a "shader" due to outdated conventions, this file
//is used to apply matrix transformations to the arrays of vertex data passed to it.
//Since this code is run on your GPU, each vertex is transformed simultaneously.
//If it were run on your CPU, each vertex would have to be processed in a FOR loop, one at a time.
//This simultaneous transformation allows your program to run much faster, especially when rendering
//geometry with millions of vertices.

uniform mat4 u_Model;       // The matrix that defines the transformation of the
                            // object we're rendering. In this assignment,
                            // this will be the result of traversing your scene graph.

uniform mat4 u_ModelInvTr;  // The inverse transpose of the model matrix.
                            // This allows us to transform the object's normals properly
                            // if the object has been non-uniformly scaled.

uniform mat4 u_ViewProj;    // The matrix that defines the camera's transformation.
                            // We've written a static matrix for you to use for HW2,
                            // but in HW3 you'll have to generate one yourself

uniform float u_Time;
uniform float u_LavaBias;
uniform float u_PlumeBias;

in vec4 vs_Pos;             // The array of vertex positions passed to the shader

in vec4 vs_Nor;             // The array of vertex normals passed to the shader

in vec4 vs_Col;             // The array of vertex colors passed to the shader.

out float fs_Shininess;
out vec3 fs_Pos;
out vec4 fs_Nor;            // The array of normals that has been transformed by u_ModelInvTr. This is implicitly passed to the fragment shader.
out vec4 fs_LightVec;       // The direction in which our virtual light lies, relative to each vertex. This is implicitly passed to the fragment shader.
out vec4 fs_Col;            // The color of each vertex. This is implicitly passed to the fragment shader.

uniform vec3 u_LightPos;

const float PI = 3.14159265;

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
vec3 random3(vec3 c) {
    float j = 4096.0*sin(dot(c, vec3(17.0, 59.4, 15.0)));
    vec3 r;
    r.z = fract(512.0*j);
    j *= .125;
    r.x = fract(512.0*j);
    j *= .125;
    r.y = fract(512.0*j);
    return r;
}

vec3 getSmoothRandom3(vec3 pt) {
    vec3 noiseSum = vec3(0.0);
    float amplitudeSum = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 8; i++) {
        vec3 freqPt = frequency * pt;
        vec3 noise = random3(freqPt);
        //vec3 noise = vec3(random2(freqPt.xy), 0.0) * 0.5 + 0.5;
        //vec3 noise = vec3(noise1(pt.x), noise1(pt.y), noise1(pt.z));
        noiseSum += noise * amplitude;
        amplitudeSum += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return noiseSum / amplitudeSum;
}

float surflet(vec3 P, vec3 gridPoint)
{
    // Compute falloff function by converting linear distance to a polynomial
    float distX = abs(P.x - gridPoint.x);
    float distY = abs(P.y - gridPoint.y);
    float distZ = abs(P.z - gridPoint.z);
    float tX = 1.0 - 6.0 * pow(distX, 5.0) + 15.0 * pow(distX, 4.0) - 10.0 * pow(distX, 3.0);
    float tY = 1.0 - 6.0 * pow(distY, 5.0) + 15.0 * pow(distY, 4.0) - 10.0 * pow(distY, 3.0);
    float tZ = 1.0 - 6.0 * pow(distZ, 5.0) + 15.0 * pow(distZ, 4.0) - 10.0 * pow(distZ, 3.0);

    // Get the random vector for the grid point
    vec3 gradient = random3(gridPoint);
    // Get the vector from the grid point to P
    vec3 diff = P - gridPoint;
    // Get the value of our height field by dotting grid->P with our gradient
    float height = dot(diff, gradient);
    // Scale our height field (i.e. reduce it) by our polynomial falloff function
    return height * tX * tY * tZ;
}

float PerlinNoise(vec3 v)
{
    // Tile the space
    vec3 vXLYLZL = floor(v);
    vec3 vXHYLZL = vXLYLZL + vec3(1.0, 0.0, 0.0);
    vec3 vXHYHZL = vXLYLZL + vec3(1.0, 1.0, 0.0);
    vec3 vXLYHZL = vXLYLZL + vec3(0.0, 1.0, 0.0);
    vec3 vXLYLZH = vXLYLZL + vec3(0.0, 0.0, 1.0);
    vec3 vXHYLZH = vXLYLZH + vec3(1.0, 0.0, 0.0);
    vec3 vXHYHZH = vXLYLZH + vec3(1.0, 1.0, 0.0);
    vec3 vXLYHZH = vXLYLZH + vec3(0.0, 1.0, 0.0);

    return surflet(v, vXLYLZL) + surflet(v, vXHYLZL) + surflet(v, vXHYHZL) + surflet(v, vXLYHZL) +
           surflet(v, vXLYLZH) + surflet(v, vXHYLZH) + surflet(v, vXHYHZH) + surflet(v, vXLYHZH);
}

float normalizedPerlinNoise(vec3 v) {
    return clamp(0.0, 1.0, PerlinNoise(v) * 0.5 + 0.5);
}

vec3 sphereToGrid(vec3 pt, float size) {
    vec3 v = pt * 0.5 + 0.5;
    return size * v;
}

struct worleyResult {
    vec3 closest0;
    float closestDist0;
    vec3 closest1;
    float closestDist1;
    vec3 normClosest0;
    vec3 normClosest1;
    vec3 normal;
};

const float WORLEY_BIG_FLOAT = 1.0e10;
const float WORLEY_EPSILON = 0.001;

worleyResult getWorley(vec3 pt, float gridSize, float timeFactor) {
    vec3 gridOrigin;
    if (gridSize >= 1.0) {
        gridOrigin.x = pt.x > 0.0 ? 0.0 : -gridSize;
        gridOrigin.y = pt.y > 0.0 ? 0.0 : -gridSize;
        gridOrigin.z = pt.z > 0.0 ? 0.0 : -gridSize;
    }
    else {
        gridOrigin = pt - mod(pt, gridSize);
    }
    worleyResult result;
    result.closest0 = vec3(0.0);
    result.closest1 = vec3(0.0);
    result.closestDist0 = WORLEY_BIG_FLOAT;
    result.closestDist1 = WORLEY_BIG_FLOAT;
    for (float i = -gridSize; i < gridSize + WORLEY_EPSILON; i += gridSize) {
        for (float j = -gridSize; j < gridSize + WORLEY_EPSILON; j += gridSize) {
            for (float k = -gridSize; k < gridSize + WORLEY_EPSILON; k += gridSize) {
                vec3 gridPt = gridOrigin + vec3(i, j, k);
                // compute random point
                vec3 randPt;
                if (timeFactor < 0.0) {
                    randPt = gridPt + random3(gridPt) * gridSize;
                }
                else {
                    randPt = gridPt + (random3(gridPt) * 0.5 + vec3(cos(u_Time * 0.0001), sin(u_Time * 0.0001), sin(u_Time * 0.0002)) * 0.25 + 0.25) * gridSize;
                }
                // find distance
                float dist = distance(randPt, pt);
                // store if closest
                if (dist < result.closestDist0) {
                    // check if closest0 is already set
                    // if it is, store it in closest1 (and distance too)
                    // we don't want to overwrite and lose them
                    if (result.closestDist0 < WORLEY_BIG_FLOAT) {
                        result.closestDist1 = result.closestDist0;
                        result.closest1 = result.closest0;
                    }
                    result.closestDist0 = dist;
                    result.closest0 = randPt;
                }
                else if (dist < result.closestDist1) {
                    result.closestDist1 = dist;
                    result.closest1 = randPt;
                }
            }
        }
    }

    result.normClosest0 = normalize(result.closest0);
    result.normClosest1 = normalize(result.closest1);

    return result;
}


const float lavaRadius = 0.01;

const vec3 LAVA_ORANGE = vec3(255.0, 110.0, 0.0) / 255.0;
const vec3 LAVA_BRIGHT_ORANGE = vec3(255.0, 142.0, 56.0) / 255.0;

const vec3 LAVA_RED = vec3(209.0, 24.0, 0.0) / 255.0;
const vec3 LAVA_BRIGHT_RED = vec3(255.0, 26.0, 56.0) / 255.0;

vec3 getLavaDisp(vec3 pt, inout worleyResult worley) {
    vec3 lavaDir = worley.normClosest0;
    float rawDist = distance(normalize(pt), worley.normClosest0);
    // compute plume going up
    float plumeDist = clamp(0.0, PI, rawDist * 20.0);
    float plumeUp = pow(cos(plumeDist) * 0.5 + 0.5, 2.5);
    // compute plume going down
    plumeDist = clamp(PI, 2.0 * PI, rawDist * 20.0);
    float plumeDown = pow(cos(plumeDist - PI) * 0.5 + 0.5, 0.8) * 0.367;
    // mix plumeUp, plumeDown, and 0 to achieve animation???
    float adjTime = u_Time * 0.001;
    vec3 rand3 = random3(worley.normClosest0);
    float rand = rand3.x * 5.0;
    float heightModifier = mix(1.0, 1.4, rand3.y);
    plumeUp *= heightModifier;
    plumeDown *= heightModifier;
    float time = cos(adjTime + rand) * 0.5 + 0.5;
    // use derivative to make time always increase
    time *= sin(adjTime + rand) > 0.0 ? 0.0 : 1.0;
    const float STEP0 = 0.433;
    const float STEP1 = 0.667;
    float s;
    s = time < STEP0 ? mix(0.0, plumeDown, smoothstep(0.0, STEP0, time)) :
        time < STEP1 ? mix(plumeDown, plumeUp, smoothstep(STEP0, STEP1, time)) :
                       mix(plumeUp, 0.0, smoothstep(STEP1, 1.0, time));
    worley.normal = vs_Pos.xyz;
    vec3 edgeColor = mix(LAVA_ORANGE, LAVA_BRIGHT_ORANGE, cos(u_Time * 0.001) * 0.5 + 0.5);
    vec3 faceColor = mix(LAVA_BRIGHT_RED, LAVA_RED, cos(u_Time * 0.001) * 0.5 + 0.5);

    return s * normalize(pt) * 0.81;
}

/* Recursive Perlin Noise */
float getRecursivePerlin(vec3 pt, float freq) {
    vec3 gridPt = sphereToGrid(pt, 6.0 * freq);
    // we recursive now boys
    float t0 = normalizedPerlinNoise(gridPt);
    return normalizedPerlinNoise(gridPt + sphereToGrid(vec3(t0) * 2.0 - vec3(1.0), 4.0 * freq));
}

/* FBM (uses Recursive Perlin) */
float getFBM(vec3 pt, float startFreq) {
    float noiseSum = 0.0;
    float amplitudeSum = 0.0;
    float amplitude = 0.5;
    float frequency = startFreq;
    for(int i = 0; i < 5; i++) {
        float perlin = getRecursivePerlin(pt, frequency);
        //uv = vec2(cos(3.14159/3.0 * i) * uv.x - sin(3.14159/3.0 * i) * uv.y, sin(3.14159/3.0 * i) * uv.x + cos(3.14159/3.0 * i) * uv.y);
        noiseSum += perlin * amplitude;
        amplitudeSum += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return noiseSum / amplitudeSum;
}

void main()
{
    fs_Col = vs_Col;                         // Pass the vertex colors to the fragment shader for interpolation

    mat3 invTranspose = mat3(u_ModelInvTr);

    const float EPSILON = 0.001;

    // LAVA =========================================================
    // this controls how large Worley cells are for lava plumes
    float plumeWorleySize = mix(0.85, 0.35, u_PlumeBias);
    worleyResult worley = getWorley(vs_Pos.xyz, plumeWorleySize, -1.0);
    // time-dependent Worley is used for picking "biomes"
    worleyResult worleyTime = getWorley(vs_Pos.xyz, 0.9, 1.0);
    // lava displacement
    vec4 lavaDisp = vec4(getLavaDisp(vs_Pos.xyz, worley), 0.0);
    // f controls which biomes this pixel is in
    float f = getFBM(worleyTime.closest0, 0.15);
    // we "scale" f to put it in a more useful range using smoothstep
    float lavaBias = mix(0.36, 0.9, u_LavaBias);
    f = smoothstep(0.35, lavaBias, f);

    // HILLS ========================================================
    // t is the height from the FBM height field
    float t = getFBM(vs_Pos.xyz, 0.5);
    // estimate normal
    const float GRADIENT_EPSILON = 0.05;
    float fbmXL = getFBM(vs_Pos.xyz - vec3(GRADIENT_EPSILON, 0.0, 0.0), 0.5);
    float fbmXH = getFBM(vs_Pos.xyz + vec3(GRADIENT_EPSILON, 0.0, 0.0), 0.5);
    float fbmYL = getFBM(vs_Pos.xyz - vec3(0.0, GRADIENT_EPSILON, 0.0), 0.5);
    float fbmYH = getFBM(vs_Pos.xyz + vec3(0.0, GRADIENT_EPSILON, 0.0), 0.5);
    float fbmZL = getFBM(vs_Pos.xyz - vec3(0.0, 0.0, GRADIENT_EPSILON), 0.5);
    float fbmZH = getFBM(vs_Pos.xyz + vec3(0.0, 0.0, GRADIENT_EPSILON), 0.5);
    vec3 fbmNormal = normalize(vec3(fbmXL - fbmXH, fbmYL - fbmYH, fbmZL - fbmZH));

    // erosion is confusingly named, but when it increases,
    // the terrain becomes less flat
    float erosion = f * smoothstep(0.33, 1.0, f);
    t = pow(t, mix(0.77, 3.0, erosion)) * mix(0.8, 3.27, erosion);
    t = 0.5 + 1.5 * t;
    vec4 naturePos = (vec4(t, t, t, 1.0) * vs_Pos);
    vec4 lavaPos = (lavaDisp + vs_Pos);
    vec4 modelposition = u_Model * mix(lavaPos, naturePos,  smoothstep(0.1667, 0.33, f));
    fs_Pos = modelposition.xyz;

    const vec3 erodedColor = vec3(124.0, 87.0, 0.0) / 255.0;
    const vec3 nonErodedColor = vec3(35.0, 94.0, 18.0) / 255.0;
    vec3 natureCol = mix(erodedColor, nonErodedColor, smoothstep(0.33, 1.0, f));
    fs_Col.xyz = natureCol;

    vec3 localNor = fbmNormal;
    fs_Nor = vec4(invTranspose * localNor, 0);

    fs_Shininess = mix(5.0, 50.0, smoothstep(0.31, 0.33, f));
    fs_LightVec = vec4(u_LightPos - modelposition.xyz, 0.0);  // Compute the direction in which the light source lies

    gl_Position = u_ViewProj * modelposition;// gl_Position is a built-in variable of OpenGL which is
                                             // used to render the final positions of the geometry's vertices
}

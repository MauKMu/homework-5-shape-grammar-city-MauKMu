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
uniform float u_TimeXZ;
uniform float u_TimeY;
uniform float u_Speed;

in vec4 vs_Pos;             // The array of vertex positions passed to the shader

in vec4 vs_Nor;             // The array of vertex normals passed to the shader

in vec4 vs_Col;             // The array of vertex colors passed to the shader.

flat out float fs_Shininess;
out vec3 fs_Pos;
out vec4 fs_Nor;            // The array of normals that has been transformed by u_ModelInvTr. This is implicitly passed to the fragment shader.
out vec4 fs_LightVec;       // The direction in which our virtual light lies, relative to each vertex. This is implicitly passed to the fragment shader.
out vec4 fs_Col;            // The color of each vertex. This is implicitly passed to the fragment shader.

const vec4 lightPos = vec4(5 + 1, 5, 3, 1); //The position of our virtual light, which is used to compute the shading of
                                            //the geometry in the fragment shader.


const vec3 a = vec3(0.4, 0.5, 0.8);
const vec3 b = vec3(0.2, 0.4, 0.2);
const vec3 c = vec3(1.0, 1.0, 2.0);
const vec3 d = vec3(0.25, 0.25, 0.0);

const vec3 e = vec3(0.2, 0.5, 0.8);
const vec3 f = vec3(0.2, 0.25, 0.5);
const vec3 g = vec3(1.0, 1.0, 0.1);
const vec3 h = vec3(0.0, 0.8, 0.2);

// Return a random direction in a circle
vec2 random2(vec2 p) {
    return normalize(2.0 * fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))))*43758.5453) - 1.0);
}
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

float rand1(float n) {
    return fract(sin(n) * 43758.5453123);
}

float noise1(float p) {
    float fl = floor(p);
    float fc = fract(p);
    return mix(rand1(fl), rand1(fl + 1.0), fc);
}

vec3 getSmoothRandom3(vec3 pt) {
    vec3 noiseSum = vec3(0.0);
    float amplitudeSum = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 8; i++) {
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

/*
vec3 Gradient(float t)
{
return a + b * cos(6.2831 * (c * t + d));
}

vec3 Gradient2(float t)
{
return e + f * cos(6.2831 * (g * t + h));
}
*/

float surflet(vec2 P, vec2 gridPoint)
{
    // Compute falloff function by converting linear distance to a polynomial
    float distX = abs(P.x - gridPoint.x);
    float distY = abs(P.y - gridPoint.y);
    float tX = 1.0 - 6.0 * pow(distX, 5.0) + 15.0 * pow(distX, 4.0) - 10.0 * pow(distX, 3.0);
    float tY = 1.0 - 6.0 * pow(distY, 5.0) + 15.0 * pow(distY, 4.0) - 10.0 * pow(distY, 3.0);

    // Get the random vector for the grid point
    vec2 gradient = random2(gridPoint);
    // Get the vector from the grid point to P
    vec2 diff = P - gridPoint;
    // Get the value of our height field by dotting grid->P with our gradient
    float height = dot(diff, gradient);
    // Scale our height field (i.e. reduce it) by our polynomial falloff function
    return height * tX * tY;
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
    //vec3 gradient = vec3(random2(gridPoint.xy), random2(gridPoint.zz).x);
    //vec3 gradient = random3(gridPoint);
    // Get the vector from the grid point to P
    vec3 diff = P - gridPoint;
    // Get the value of our height field by dotting grid->P with our gradient
    float height = dot(diff, gradient);
    // Scale our height field (i.e. reduce it) by our polynomial falloff function
    return height * tX * tY * tZ;
}

float PerlinNoise(vec2 uv)
{
    // Tile the space
    vec2 uvXLYL = floor(uv);
    vec2 uvXHYL = uvXLYL + vec2(1, 0);
    vec2 uvXHYH = uvXLYL + vec2(1, 1);
    vec2 uvXLYH = uvXLYL + vec2(0, 1);

    return surflet(uv, uvXLYL) + surflet(uv, uvXHYL) + surflet(uv, uvXHYH) + surflet(uv, uvXLYH);
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

/*
vec2 PixelToGrid(vec2 pixel, float size)
{
vec2 uv = pixel.xy / u_Dimensions.xy;
// Account for aspect ratio
uv.x = uv.x * float(u_Dimensions.x) / float(u_Dimensions.y);
// Determine number of cells (NxN)
uv *= size;

return uv;
}
*/

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
                //vec3 randPt = gridPt + (random3(gridPt) * 0.5 + vec3(cos(u_Time * 0.0001), sin(u_Time * 0.0001), sin(u_Time * 0.0002)) * 0.25 + 0.25) * gridSize;
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


/* Buildings -- with Worley */
const float streetRadius = 0.12;

vec3 getBldgDisp(vec3 pt, inout worleyResult worley) {
    vec3 bldgDir = worley.normClosest0;
    // compute distance from border
    // 1 - 0 makes it point in the direction we want for normal
    vec3 diff = worley.normClosest1 - worley.normClosest0;
    vec3 borderNormal = normalize(diff);
    vec3 toClosest = pt - worley.normClosest0;
    float distFromClosest = abs(dot(toClosest, borderNormal));
    float distToBorder = 0.5 * length(diff) - distFromClosest;
    float dist = distToBorder;// distance(pt, bldgDir);
    float projLen = dot(bldgDir, pt);
    // determines whether we are "on" the building
    float s = (dist > streetRadius ? 1.0 : 0.0);
    worley.normal = abs(dist - streetRadius) < (0.05 * streetRadius) ? borderNormal : bldgDir;
    // (bldgHeight - projLen) + bldgHeight
    float bldgHeight = random3(worley.closest0).x * 0.55 + 0.75;
    s *= (2.0 * bldgHeight - projLen);
    return s * bldgDir;
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
    for (int i = 0; i < 5; i++) {
        float perlin = getRecursivePerlin(pt, frequency);
        //uv = vec2(cos(3.14159/3.0 * i) * uv.x - sin(3.14159/3.0 * i) * uv.y, sin(3.14159/3.0 * i) * uv.x + cos(3.14159/3.0 * i) * uv.y);
        noiseSum += perlin * amplitude;
        amplitudeSum += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return noiseSum / amplitudeSum;
    /*
    float rawFBM = noiseSum / amplitudeSum;
    float t = cos(u_Time * 0.001);
    bool eroded = t > 0.0;
    return pow(rawFBM, eroded ? 1.0 : 3.0) * (eroded ? 0.8 : 1.87) + (eroded ? 0.0 : 0.2);
    */
}

void main()
{
    fs_Col = vs_Col;                         // Pass the vertex colors to the fragment shader for interpolation

    mat3 invTranspose = mat3(u_ModelInvTr);

    const float PI = 3.14159265;
    const float EPSILON = 0.001;
    const float BLDG_EPSILON = 0.1;
    float time = u_Speed * u_Time * 0.0001;
    worleyResult worley = getWorley(vs_Pos.xyz, 0.65, -1.0);
    worleyResult worleyTime = getWorley(vs_Pos.xyz, 0.9, 1.0);
    vec4 bldgDisp = vec4(getBldgDisp(vs_Pos.xyz, worley), 0.0);
    if (length(bldgDisp) < EPSILON) {
        worley.normal = vs_Nor.xyz;
    }
    fs_Col = vec4(getSmoothRandom3(worley.closest0), 1.0);
    float f = getFBM(worleyTime.closest0, 0.15);
    f = smoothstep(0.35, 0.6, f);
    //f = pow(f, 3.0) * 1.5;
    //f = f > 0.3 ? (f * 1.5) : f;
    //f = clamp(0.25, 0.75, f) * 2.0 - 0.5;
    fs_Col = vec4(f, 0.33, 0.33, 1.0);
    if (distance(normalize(vs_Pos.xyz), worleyTime.normClosest0) < 0.04) {
        fs_Col.xyz = vec3(1.0) - fs_Col.xyz;
    }
    //fs_Col.xyz = getSmoothRandom3(vs_Pos.xyz);

    //fs_Nor = vec4(invTranspose * vec3(worley.normal), 0);
    // fs_Nor = vec4(invTranspose * bldgNormal, 0.0);          // Pass the vertex normals to the fragment shader for interpolation.
    // Transform the geometry's normals by the inverse transpose of the
    // model matrix. This is necessary to ensure the normals remain
    // perpendicular to the surface after the surface is transformed by
    // the model matrix.
    // problem with buildings: normals???
    // nature
    /*
    float timeXZ = u_Speed * u_TimeXZ;
    float timeY = u_Speed * u_TimeY;
    float cleanX = abs(vs_Pos.x) < EPSILON ? (EPSILON * sign(vs_Pos.x)) : vs_Pos.x;
    float xzAngle = atan(vs_Pos.z, cleanX) * (6.0 - smoothstep(0.0, 1.0, (sin(timeXZ * 0.000314 * 2.0) * 0.5 + 0.5)) * 12.0);
    float y = vs_Pos.y * (10.0 + smoothstep(0.0, 1.0, (sin(timeY * 0.000314) * 0.5 + 0.5)) * 40.0);
    float t = cos(time * 0.002 + y + xzAngle) * 0.25 + 1.0;

    vec4 modelposition = u_Model * (vec4(t, t, t, 1.0) * vs_Pos);   // Temporarily store the transformed vertex positions for use below
    */
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
    //float t = normalizedPerlinNoise(vec3(t0, t1, t2));
    /*
    float dist = distance(normalize(vs_Pos.xyz), bldgDir);
    const float RADIUS = 0.75;
    float s = 0.1 + smoothstep(0.0, RADIUS, RADIUS - dist);
    */
    //float erosion = cos(u_Time * 0.001) * 0.5 + 0.5;
    float xzAngle = cos(atan(vs_Pos.z, vs_Pos.x) + u_Time * 0.001) * 0.5 + 0.5;
    xzAngle = f;
    float erosion = f * smoothstep(0.33, 1.0, xzAngle);
    t = pow(t, mix(0.77, 3.0, erosion)) * mix(0.8, 3.27, erosion) + mix(0.0, 0.0, erosion);
    t = 0.5 + 1.5 * t;
    //fs_Col.xyz = vec3(t - 1.0);
    //t = pow(t, mix(1.0, 1.44, cos(time * 10.0) * 0.5 + 0.5));
    vec4 naturePos = u_Model * (vec4(t, t, t, 1.0) * vs_Pos);   // Temporarily store the transformed vertex positions for use below
    vec4 bldgPos = u_Model * (bldgDisp + vs_Pos);   // Temporarily store the transformed vertex positions for use below
    vec4 modelposition = mix(bldgPos, naturePos, smoothstep(0.1667, 0.33, xzAngle));
    fs_Pos = modelposition.xyz;

    const vec3 erodedColor = vec3(124.0, 87.0, 0.0) / 255.0;
    const vec3 nonErodedColor = vec3(35.0, 94.0, 18.0) / 255.0;
    vec3 natureCol = mix(erodedColor, nonErodedColor, smoothstep(0.33, 1.0, xzAngle));
    vec3 bldgCol = vec3(0.8, 0.8, 0.8);
    fs_Col.xyz = mix(bldgCol, natureCol, smoothstep(0.1667, 0.47, xzAngle));

    //vec3 localNor = fbmNormal;
    //vec3 localNor = vs_Nor.xyz;
    vec3 localNor = mix(worley.normal, fbmNormal, smoothstep(0.1667, 0.33, xzAngle));
    fs_Nor = vec4(invTranspose * localNor, 0);

    fs_Shininess = mix(5.0, 50.0, smoothstep(0.29, 0.33, xzAngle));
    fs_LightVec = lightPos - modelposition;  // Compute the direction in which the light source lies

    gl_Position = u_ViewProj * modelposition;// gl_Position is a built-in variable of OpenGL which is
                                             // used to render the final positions of the geometry's vertices
}
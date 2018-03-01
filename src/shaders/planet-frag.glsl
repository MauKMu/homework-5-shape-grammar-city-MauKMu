#version 300 es

// This is a fragment shader. If you've opened this file first, please
// open and read lambert.vert.glsl before reading on.
// Unlike the vertex shader, the fragment shader actually does compute
// the shading of geometry. For every pixel in your program's output
// screen, the fragment shader is run for every bit of geometry that
// particular pixel overlaps. By implicitly interpolating the position
// data passed into the fragment shader by the vertex shader, the fragment shader
// can compute what color to apply to its pixel based on things like vertex
// position, light position, and vertex color.
precision highp float;

uniform vec4 u_Color; // The color with which to render this instance of geometry.

uniform float u_Time;
uniform float u_Speed;
uniform float u_PlumeBias;
uniform float u_EdgeClarity;

uniform vec3 u_EyePos;

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec3 fs_Pos;
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in float fs_Shininess;

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
    float bldgHeight = random3(worley.closest0).x * 0.35 + 0.65;
    s *= (2.0 * bldgHeight - projLen);
    return s * bldgDir;
}

const float lavaRadius = 0.01;

const vec3 LAVA_ORANGE = vec3(255.0, 110.0, 0.0) / 255.0;
const vec3 LAVA_BRIGHT_ORANGE = vec3(255.0, 142.0, 56.0) / 255.0;

const vec3 LAVA_RED = vec3(183.0, 21.0, 0.0) / 255.0;
const vec3 LAVA_BRIGHT_RED = vec3(209.0, 24.0, 0.0) / 255.0;

vec3 getLavaColor(vec3 pt, worleyResult worley) {
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
    //float s = (dist > lavaRadius ? 1.0 : 0.0);
    float edgeClarity = mix(40.0, 2.0, u_EdgeClarity);
    float s = smoothstep(0.0, edgeClarity * lavaRadius, dist - lavaRadius);
    vec3 faceColor = mix(LAVA_ORANGE, LAVA_BRIGHT_ORANGE, cos(u_Time * 0.001) * 0.5 + 0.5);
    vec3 edgeColor = mix(LAVA_BRIGHT_RED, LAVA_RED, cos(u_Time * 0.001) * 0.5 + 0.5);

    return mix(edgeColor, faceColor, s);
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
}

vec4 getFBMNormal(vec3 pt) {
    vec3 adjPt = pt + vec3(sin(u_Time * 0.00001), cos(u_Time * 0.000034), cos(cos(u_Time * 0.000002) * PI));
    float t = getFBM(adjPt, 0.5);
    // estimate normal
    const float GRADIENT_EPSILON = 0.05;
    float fbmXL = getFBM(adjPt - vec3(GRADIENT_EPSILON, 0.0, 0.0), 0.5);
    float fbmXH = getFBM(adjPt + vec3(GRADIENT_EPSILON, 0.0, 0.0), 0.5);
    float fbmYL = getFBM(adjPt - vec3(0.0, GRADIENT_EPSILON, 0.0), 0.5);
    float fbmYH = getFBM(adjPt + vec3(0.0, GRADIENT_EPSILON, 0.0), 0.5);
    float fbmZL = getFBM(adjPt - vec3(0.0, 0.0, GRADIENT_EPSILON), 0.5);
    float fbmZH = getFBM(adjPt + vec3(0.0, 0.0, GRADIENT_EPSILON), 0.5);
    return vec4(normalize(vec3(fbmXL - fbmXH, fbmYL - fbmYH, fbmZL - fbmZH)), 0.0);
}



out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.

void main()
{
        vec4 diffuseColor = vec4(1.0);
        diffuseColor.xyz = vec3(0.89);
        diffuseColor.xyz = fs_Col.xyz;

        // Calculate the diffuse term for Lambert shading
        float adjShininess = fs_Shininess;
        vec4 adjNor = adjShininess <= 5.0 ? getFBMNormal(fs_Pos) : fs_Nor;
        /*
        vec3 tbnNormal = normalize(fs_Pos);
        vec3 tbnTangent = normalize(cross(vec3(0.0, 1.0, 0.0), tbnNormal));
        vec3 tbnBitangent = normalize(cross(tbnNormal, tbnTangent));
        mat3 tbn;// = mat3(tbnTangent, tbnBitangent, tbnNormal);
        tbn[0] = tbnBitangent;
        tbn[1] = tbnNormal;
        tbn[2] = tbnTangent;
        adjNor.xyz = tbn * adjNor.xyz;// vec3(0.0, 1.0, 0.0);
        */

        float diffuseTerm = dot(normalize(adjNor), normalize(fs_LightVec));
        // pretend we know how to shade things
        diffuseTerm *= mix(0.3, 1.0, smoothstep(-0.7, 0.3, dot(normalize(fs_Pos), normalize(fs_LightVec.xyz))));
        // Avoid negative lighting values
        diffuseTerm = (adjShininess <= 5.0 ? 1.0 : clamp(diffuseTerm, 0.0, 1.0)) * 0.9;
        float plumeWorleySize = mix(0.85, 0.35, u_PlumeBias);
        worleyResult worley = getWorley(normalize(fs_Pos), plumeWorleySize, 1.0);
        vec3 lavaColor = getLavaColor(normalize(fs_Pos), worley);
        diffuseColor.xyz = adjShininess <= 5.0 ? lavaColor : diffuseColor.xyz;
        diffuseColor.xyz = mix(lavaColor, diffuseColor.xyz, smoothstep(4.0, 50.0, adjShininess));


        float ambientTerm = 0.1;

        vec3 halfVec = normalize(fs_LightVec.xyz + normalize(u_EyePos - fs_Pos));
        float specularTerm = pow(max(0.0, dot(halfVec, adjNor.xyz)), adjShininess);
        specularTerm = adjShininess > 5.5 ? 0.0 : (0.0, 0.5, specularTerm);

        float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
                                                            //to simulate ambient lighting. This ensures that faces that are not
                                                            //lit by our point light are not completely black.

        // Compute final shaded color
        out_Col = vec4(diffuseColor.rgb * lightIntensity, diffuseColor.a);
        out_Col.xyz += vec3(specularTerm);
}

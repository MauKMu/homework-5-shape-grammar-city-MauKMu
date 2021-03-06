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

//uniform sampler2D u_Sampler0;

uniform vec3 u_LightPos;
uniform float u_PerlinSeed;
uniform int u_ShowWindows;

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec4 fs_Pos;
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in vec2 fs_UV;

out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.

// from Adam's demo
vec2 random2(vec2 p) {
    //vec2 sinVec = sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))));
    //return sinVec * 0.5 + vec2(0.5);
    //return fract(sinVec * 123.45);
    //return fract(sinVec * 43758.5453);
    return normalize(2.0 * fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))))*123.45) - 1.0);
}

float surflet(vec2 P, vec2 gridPoint)
{
    //return (P.x * P.x) * 0.07;
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

float PerlinNoise(vec2 uv)
{
    // Tile the space
    vec2 uvXLYL = floor(uv);
    vec2 uvXHYL = uvXLYL + vec2(1, 0);
    vec2 uvXHYH = uvXLYL + vec2(1, 1);
    vec2 uvXLYH = uvXLYL + vec2(0, 1);

    return surflet(uv, uvXLYL) + surflet(uv, uvXHYL) + surflet(uv, uvXHYH) + surflet(uv, uvXLYH);
}


float normalizedPerlinNoise(vec2 v) {
    return clamp(0.0, 1.0, PerlinNoise(v) + 0.5);
}

/* FBM (uses Perlin) */
float getFBM(vec2 pt, float startFreq) {
    float noiseSum = 0.0;
    float amplitudeSum = 0.0;
    float amplitude = 1.0;
    float frequency = startFreq;
    for (int i = 0; i < 5; i++) {
        float perlin = normalizedPerlinNoise(pt * frequency);
        noiseSum += perlin * amplitude;
        amplitudeSum += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return noiseSum / amplitudeSum;
}

// "normalizes" coordinate before calling FBM
float getFBMFromRawPosition(vec2 pos, float startFreq) {
    vec2 coord = pos / 150.0;
    coord += vec2(3.14, 5.01) + vec2(u_PerlinSeed);
    //return pow(sin(coord.x + coord.y), 2.0);
    return getFBM(coord, startFreq);
}

void main()
{
    // Material base color (before shading)
        vec4 diffuseColor = fs_Col;
        // read texture
        if (fs_UV.x >= 0.0 && fs_UV.x < 2.0) { 
            //diffuseColor = texture(u_Sampler0, fs_UV);
            diffuseColor = vec4(fs_UV, 0.0, 1.0);
        }

        // Calculate the diffuse term for Lambert shading
        float diffuseTerm = dot(normalize(fs_Nor.xyz), normalize(u_LightPos));
        // Avoid negative lighting values
        diffuseTerm = 0.8 * clamp(diffuseTerm, 0.0, 1.0);

        float ambientTerm = 0.2;

        float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
                                                            //to simulate ambient lighting. This ensures that faces that are not
                                                            //lit by our point light are not completely black.

        // Compute final shaded color
        out_Col = vec4(diffuseColor.rgb * lightIntensity, diffuseColor.a);
        // handle windows
        if (fs_UV.x > 199.99) {
            if (u_ShowWindows > 0) {
                vec2 uv = fs_UV - vec2(200.0);
                vec2 modUV = fract(uv);
                if (0.35 < modUV.x && modUV.x < 0.65 && 0.35 < modUV.y && modUV.y < 0.65) {
                    if (fs_UV.x > 249.99) {
                        out_Col = vec4(0.3, 0.3, 0.3, 1);
                    }
                    else {
                        out_Col = vec4(1, 1, 0.85, 1);
                    }
                }
            }
        }
        // handle ground plane
        else if (fs_UV.x > 99.99) {
            float fbm = getFBMFromRawPosition(fs_Pos.xz, 0.5);
            // remap FBM because it's apparently in [0.25, 0.65]
            fbm = (fbm - 0.25) / 0.4;
            float biasedFBM = fbm * 1.5;
            vec3 palette = mix(vec3(0.04, 0.4, 0.12), vec3(0.53, 0.53, 0.53), min(1.0, biasedFBM));
            float fbmAux = getFBMFromRawPosition(fs_Pos.xz + vec2(9.91, -4.33), 0.25);
            fbmAux = min(1.0, (fbmAux - 0.25) / 0.4 + 0.7);
            fbmAux = mix(fbmAux, 1.0, smoothstep(0.6, 1.1, biasedFBM));
            //fbm = pow(fbm, 2.0);
            out_Col = vec4(vec3(fbm), 1);
            float streetiness = smoothstep(0.3, 0.5, biasedFBM);
            vec3 streetColor = palette;
            if ((mod(fs_Pos.x + 3.5, 150.0 / 45.0 * 2.0) < 1.0) ||
                (mod(fs_Pos.z + 3.5, 150.0 / 45.0 * 2.0) < 1.0)) {
                streetColor = vec3(0.1, 0.1, 0.1);
            }
            palette = mix(palette, streetColor, streetiness);
            out_Col = vec4(palette * fbmAux, 1); 
            //out_Col = vec4((fs_Pos.xz / 50.0) * 0.5 + vec2(0.5), 0.0, 1.0);
        }
        //out_Col = vec4(fs_Nor.xyz * 0.5 + vec3(0.5), 1.0);
}

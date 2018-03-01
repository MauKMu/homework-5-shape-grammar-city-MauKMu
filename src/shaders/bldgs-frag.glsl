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

uniform vec3 u_EyePos;

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec3 fs_Pos;
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
flat in float fs_Shininess;

out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.

void main()
{
    out_Col = fs_Col;
    //return;
    // Material base color (before shading)
    // IQ's iridescent palette...
    vec3 bias = abs(fs_Nor.xyz);
    vec3 scale = vec3(1.0) - bias;
    vec3 freq = vec3(1.5, 0.5, 1.1);
    vec3 phase = vec3(0.0, 0.5, 0.33);
    float t = u_Speed * u_Time * 0.0001;
    vec3 iridescent = bias + scale * cos(freq * t + phase);
    // With alternating between the color and its RGB->GBR shifted version
    float tShift = smoothstep(0.0, 1.0, (sin(u_Time * 0.000314) * 0.5 + 0.5));
    vec4 baseColor = vec4(iridescent, 1.0);
    vec4 altColor = baseColor.yzxw;
    vec4 diffuseColor = mix(baseColor, altColor, tShift);
    diffuseColor.xyz = vec3(0.89);
    diffuseColor.xyz = fs_Col.xyz;

    // Calculate the diffuse term for Lambert shading
    float diffuseTerm = dot(normalize(fs_Nor), normalize(fs_LightVec));
    // Avoid negative lighting values
    diffuseTerm = clamp(diffuseTerm, 0.0, 1.0) * 0.7;

    float ambientTerm = 0.3;

    vec3 halfVec = normalize(fs_LightVec.xyz + normalize(u_EyePos - fs_Pos));
    float specularTerm = pow(max(0.0, dot(halfVec, fs_Nor.xyz)), fs_Shininess);
    specularTerm = fs_Shininess > 5.5 ? 0.0 : (0.0, 0.5, specularTerm);

    float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
                                                        //to simulate ambient lighting. This ensures that faces that are not
                                                        //lit by our point light are not completely black.

                                                        // Compute final shaded color
    out_Col = vec4(diffuseColor.rgb * lightIntensity, diffuseColor.a);
    out_Col.xyz += vec3(specularTerm);
}
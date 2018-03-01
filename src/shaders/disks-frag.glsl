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

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;

out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.

void main()
{
        // Material base color (before shading)
        float time = u_Speed * u_Time;
        float tX = cos(time * 0.001) * 0.5 + 0.5;
        float tY = cos(time * 0.00176) * 0.5 + 0.5;
        float tZ = cos(time * 0.00287) * 0.5 + 0.5;
        vec3 col = abs(fs_Nor.xyz) + vec3(tX, tY, tZ);
        col.x = col.x > 1.0 ? col.x - 1.0 : col.x;
        col.y = col.y > 1.0 ? col.y - 1.0 : col.y;
        col.z = col.z > 1.0 ? col.z - 1.0 : col.z;
        out_Col = vec4(col, 1.0);
}

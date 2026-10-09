varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vPosition);

  float fresnel = pow(0.6 - dot(normal, viewDir), 2.5);

  vec3 atmosphereColor = vec3(0.0, 0.78, 0.84);

  float intensity = fresnel * 0.6;

  gl_FragColor = vec4(atmosphereColor, intensity);
}

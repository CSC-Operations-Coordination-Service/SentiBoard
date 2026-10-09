varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D dayTexture;
uniform sampler2D nightTexture;
uniform sampler2D normalMap;
uniform sampler2D specularMap;
uniform sampler2D cloudsTexture;
uniform vec3 lightDirection;
uniform float cloudOpacity;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 sunDir = normalize(lightDirection);

  float terminator = dot(normal, sunDir);
  float terminator_soft = smoothstep(-0.1, 0.1, terminator);

  vec3 dayColor = texture2D(dayTexture, vUv).rgb;
  vec3 nightColor = texture2D(nightTexture, vUv).rgb;

  vec3 cloudColor = texture2D(cloudsTexture, vUv).rgb;
  vec3 combinedDay = mix(dayColor, cloudColor, cloudOpacity);

  vec3 color = mix(nightColor, combinedDay, terminator_soft);

  vec4 specularMapSample = texture2D(specularMap, vUv);
  float specularity = specularMapSample.r;

  vec3 viewDir = normalize(-vPosition);
  vec3 halfDir = normalize(sunDir + viewDir);
  float specAngle = max(dot(normal, halfDir), 0.0);
  float specular = pow(specAngle, 32.0) * specularity * terminator_soft * 0.5;

  color += vec3(specular);

  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}

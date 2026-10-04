// A small JSON-schema subset for checking model output: type, required, properties, items, enum.
// Returns a list of problems; an empty list means the value is valid.
export function validate(value, schema, path = 'output') {
  if (!schema) return [];
  const types = [].concat(schema.type || []);
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (types.length && !types.includes(actual)) return [`${path} should be ${types.join(' or ')}, got ${actual}`];
  if (schema.enum && !schema.enum.includes(value)) return [`${path} should be one of ${schema.enum.join(', ')}`];

  const problems = [];
  if (actual === 'object') {
    (schema.required || []).forEach((key) => { if (!(key in value)) problems.push(`${path}.${key} is missing`); });
    Object.entries(schema.properties || {}).forEach(([key, sub]) => {
      if (key in value) problems.push(...validate(value[key], sub, `${path}.${key}`));
    });
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      Object.keys(value)
        .filter((key) => !(schema.properties || {})[key])
        .forEach((key) => problems.push(...validate(value[key], schema.additionalProperties, `${path}.${key}`)));
    }
  }
  if (actual === 'array' && schema.items) value.forEach((item, i) => problems.push(...validate(item, schema.items, `${path}[${i}]`)));
  return problems;
}

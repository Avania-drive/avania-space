// «Se entra con» Google, Meta o Apple: hay accesos que no tienen contraseña propia, solo se verifican con uno de esos servicios.
export const SSO = ['google', 'meta', 'apple'];
export const ssoList = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x).toLowerCase()).filter((x) => SSO.includes(x)))];

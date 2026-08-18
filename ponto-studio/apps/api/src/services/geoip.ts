import geoip from "geoip-lite";

/**
 * Localização aproximada a partir do IP (banco MaxMind GeoLite embutido no
 * pacote — sem chamada externa, sem popup de permissão no navegador).
 * Precisão de cidade/estado/país, não GPS. `null` pra IP local/privado (dev)
 * ou quando o IP não está na base.
 */
export function lookupLocation(ip: string): { city?: string; region?: string; country?: string } | null {
  const clean = ip.replace(/^::ffff:/, "");
  const result = geoip.lookup(clean);
  if (!result) return null;
  return {
    ...(result.city ? { city: result.city } : {}),
    ...(result.region ? { region: result.region } : {}),
    ...(result.country ? { country: result.country } : {}),
  };
}

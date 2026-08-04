import { storyblokEditable } from "@storyblok/react/rsc";
import type { DataTableBlok } from "@/lib/types";

/** Tabela de dados — o 2xa.studio usa pra listar prêmios; aqui serve pra
 * qualquer lista tabular editável no Storyblok (stack, clientes, etc).
 * `headers` é uma string separada por vírgula (ex.: "Projeto,Ano,Papel"). */
export function DataTable({ blok }: { blok: DataTableBlok }) {
  const theme = blok.theme ?? "dark";
  const headers = blok.headers?.split(",").map((h) => h.trim()) ?? [];

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-16 md:py-24`}
    >
      {blok.heading && (
        <h2 className="text-heading mb-10">{blok.heading}</h2>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {headers.length > 0 && (
            <thead>
              <tr className="border-b border-border">
                {headers.map((h) => (
                  <th key={h} className="text-label py-3 pr-6 text-fg-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {blok.rows?.map((row) => (
              <tr key={row._uid} className="border-b border-border">
                {[row.col_1, row.col_2, row.col_3, row.col_4]
                  .filter((cell) => cell !== undefined)
                  .map((cell, i) => (
                    <td key={i} className="text-body py-3 pr-6">
                      {cell}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 渲染一条 JSON-LD 结构化数据；入参必须是 `jsonLdGraph()` 产出的已转义 JSON 字符串。 */
export function StructuredData({ json, id }: { id: string; json: string }) {
  return <script dangerouslySetInnerHTML={{ __html: json }} id={id} type='application/ld+json' />
}

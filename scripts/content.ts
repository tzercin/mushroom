import path from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'

export const contentId = z.string().regex(/^[a-z0-9-]+$/, 'ids are lowercase-kebab-case')

/** Content is data: only plain YAML front matter is accepted, never executable engines. */
export function parseContent(source: string): { data: unknown; content: string } {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  if (!lines[0].startsWith('---')) return { data: {}, content: text }
  if (lines[0].trimEnd() !== '---') throw new Error('Only plain YAML front matter is supported')
  const end = lines.findIndex((line, i) => i > 0 && line.trimEnd() === '---')
  if (end < 0) throw new Error('Unclosed YAML front matter')
  return {
    data: YAML.parse(lines.slice(1, end).join('\n'), { customTags: [], maxAliasCount: 100 }) ?? {},
    content: lines.slice(end + 1).join('\n'),
  }
}

const SpeciesMetadata = z.object({ id: contentId, latin: z.string().trim().min(1) })

/** Validate before making requests or deriving any output path. */
export function occurrenceTarget(data: unknown, file: string, out: string) {
  const species = SpeciesMetadata.parse(data)
  if (`${species.id}.md` !== file) throw new Error(`${file}: id must match the file name`)
  const outputPath = path.resolve(out, `${species.id}.json`)
  if (path.dirname(outputPath) !== path.resolve(out)) throw new Error('Output must stay in the distribution directory')
  return { ...species, outputPath }
}

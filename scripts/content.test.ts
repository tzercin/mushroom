import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { occurrenceTarget, parseContent } from './content'

test('parses YAML with BOM/CRLF and preserves descriptions without front matter', () => {
  assert.deepEqual(parseContent('\uFEFF---\r\nid: amanita-muscaria\r\n---\r\n## en\r\nExample'), {
    data: { id: 'amanita-muscaria' }, content: '## en\nExample',
  })
  assert.deepEqual(parseContent('## en\nExample'), { data: {}, content: '## en\nExample' })
  assert.throws(() => parseContent('---\nid: example'), /Unclosed/)
})

test('rejects executable front matter without evaluating it', () => {
  const marker = '__mushroomSecurityTest'
  const globals = globalThis as unknown as Record<string, unknown>
  try {
    for (const engine of ['js', 'javascript', 'json', 'yaml', ' js', '\tjavascript']) {
      globals[marker] = false
      const input = `---${engine}\n(() => { globalThis.${marker} = true; return {}; })()\n---\nText`
      assert.throws(() => parseContent(input), /Only plain YAML/)
      assert.equal(globals[marker], false)
    }
  } finally {
    delete globals[marker]
  }
})

test('only matching safe species IDs can produce occurrence output paths', () => {
  const out = path.resolve('content/distribution')
  for (const id of ['../../package', '../outside', '/tmp/outside', '..\\outside', '%2e%2e%2fpackage', '', 'x\n']) {
    assert.throws(() => occurrenceTarget({ id, latin: 'Amanita muscaria' }, `${id}.md`, out))
  }
  assert.throws(() => occurrenceTarget({ id: 'safe', latin: 'Example' }, 'other.md', out), /match/)
  assert.throws(() => occurrenceTarget({ id: 'safe' }, 'safe.md', out))
  assert.throws(() => occurrenceTarget({ id: 'safe', latin: '' }, 'safe.md', out))
  assert.deepEqual(occurrenceTarget({ id: 'safe', latin: 'Example' }, 'safe.md', out), {
    id: 'safe', latin: 'Example', outputPath: path.join(out, 'safe.json'),
  })
})

test('Docker enforces the same CSP as Cloudflare on all responses', () => {
  const root = path.resolve(import.meta.dirname, '..')
  const headers = fs.readFileSync(path.join(root, 'public/_headers'), 'utf8')
  const nginx = fs.readFileSync(path.join(root, 'docker/nginx.conf'), 'utf8')
  const csp = headers.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1]
  assert.ok(csp)
  assert.ok(nginx.includes(`add_header Content-Security-Policy "${csp}" always;`))
})

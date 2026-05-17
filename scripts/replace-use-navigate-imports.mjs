#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
const targetExt = new Set(['.ts', '.tsx', '.js', '.jsx'])
const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage'])

const summary = {
  scanned: 0,
  changed: 0,
  changedFiles: [],
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.storybook') {
      if (entry.name === '.git') continue
    }

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue
      walk(fullPath)
      continue
    }

    if (!targetExt.has(path.extname(entry.name))) continue
    rewriteFile(fullPath)
  }
}

function rewriteFile(filePath) {
  summary.scanned += 1

  const original = fs.readFileSync(filePath, 'utf8')
  let next = original

  const singleUseNavigateImport = /import\s*\{\s*useNavigate\s*\}\s*from\s*['"]@tanstack\/react-router['"];?/g
  next = next.replace(singleUseNavigateImport, "import { useAppNavigate as useNavigate } from '@/router'")

  const mixedImport = /import\s*\{([^}]*)\}\s*from\s*['"]@tanstack\/react-router['"];?/g
  next = next.replace(mixedImport, (full, rawMembers) => {
    const members = rawMembers
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (!members.some((item) => item === 'useNavigate')) {
      return full
    }

    const remaining = members.filter((item) => item !== 'useNavigate')

    if (remaining.length === 0) {
      return "import { useAppNavigate as useNavigate } from '@/router'"
    }

    return [
      `import { ${remaining.join(', ')} } from '@tanstack/react-router'`,
      `import { useAppNavigate as useNavigate } from '@/router'`,
    ].join('\n')
  })

  if (next === original) return

  fs.writeFileSync(filePath, next, 'utf8')
  summary.changed += 1
  summary.changedFiles.push(path.relative(rootDir, filePath))
}

walk(rootDir)

console.log(`扫描文件数: ${summary.scanned}`)
console.log(`修改文件数: ${summary.changed}`)
if (summary.changedFiles.length > 0) {
  console.log('已修改文件:')
  for (const file of summary.changedFiles) {
    console.log(`- ${file}`)
  }
}

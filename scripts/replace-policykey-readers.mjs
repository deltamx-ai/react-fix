#!/usr/bin/env node
import path from 'node:path'
import {
  Node,
  Project,
  QuoteKind,
  SyntaxKind,
  VariableDeclarationKind,
} from 'ts-morph'

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
const targetImportPath = process.argv[3] || '@/hooks/usePolicyKey'
const dryRun = process.argv.includes('--dry-run')

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: {
    quoteKind: QuoteKind.Single,
  },
})

project.addSourceFilesAtPaths([
  path.join(rootDir, '**/*.ts'),
  path.join(rootDir, '**/*.tsx'),
  `!${path.join(rootDir, '**/node_modules/**')}`,
  `!${path.join(rootDir, '**/.git/**')}`,
  `!${path.join(rootDir, '**/dist/**')}`,
  `!${path.join(rootDir, '**/build/**')}`,
  `!${path.join(rootDir, '**/coverage/**')}`,
])

const summary = {
  scanned: 0,
  changed: 0,
  skipped: 0,
  changedFiles: [],
  skippedFiles: [],
}

for (const sourceFile of project.getSourceFiles()) {
  summary.scanned += 1
  const result = rewriteSourceFile(sourceFile)

  if (result === 'changed') {
    summary.changed += 1
    summary.changedFiles.push(path.relative(rootDir, sourceFile.getFilePath()))
  } else if (result === 'skipped') {
    summary.skipped += 1
    summary.skippedFiles.push(path.relative(rootDir, sourceFile.getFilePath()))
  }
}

if (!dryRun) {
  await project.save()
}

console.log(`扫描文件数: ${summary.scanned}`)
console.log(`修改文件数: ${summary.changed}`)
console.log(`跳过文件数: ${summary.skipped}`)

if (summary.changedFiles.length) {
  console.log('已修改文件:')
  for (const file of summary.changedFiles) {
    console.log(`- ${file}`)
  }
}

if (summary.skippedFiles.length) {
  console.log('跳过文件:')
  for (const file of summary.skippedFiles) {
    console.log(`- ${file}`)
  }
}

function rewriteSourceFile(sourceFile) {
  const filePath = sourceFile.getFilePath()
  if (filePath.endsWith(`${path.sep}src${path.sep}hooks${path.sep}usePolicyKey.ts`)) {
    return 'skipped'
  }

  let changed = false
  let hasUsePolicyKeyCall = false

  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpr.getExpression()

    if (Node.isIdentifier(expression) && expression.getText() === 'usePolicyKey') {
      hasUsePolicyKeyCall = true
      continue
    }

    if (
      Node.isIdentifier(expression) &&
      expression.getText() === 'useSearch'
    ) {
      changed = rewriteUseSearchUsage(callExpr) || changed
      continue
    }

    if (Node.isPropertyAccessExpression(expression)) {
      const left = expression.getExpression().getText()
      const right = expression.getName()
      if (left === 'Route' && right === 'useSearch') {
        changed = rewriteUseSearchUsage(callExpr) || changed
      }
    }
  }

  if (!changed) {
    return hasUsePolicyKeyCall ? 'skipped' : 'unchanged'
  }

  ensureUsePolicyKeyImport(sourceFile)
  sourceFile.formatText({ indentSize: 2 })
  return 'changed'
}

function rewriteUseSearchUsage(callExpr) {
  const parent = callExpr.getParent()

  if (Node.isPropertyAccessExpression(parent) && parent.getName() === 'policyKey') {
    parent.replaceWithText('usePolicyKey()')
    return true
  }

  if (Node.isVariableDeclaration(parent)) {
    const nameNode = parent.getNameNode()

    if (Node.isObjectBindingPattern(nameNode)) {
      const elements = nameNode.getElements()
      const policyEl = elements.find((el) => el.getName() === 'policyKey')
      if (!policyEl) return false

      const remaining = elements.filter((el) => el !== policyEl)
      const initializerText = callExpr.getText()
      const statement = parent.getFirstAncestorByKind(SyntaxKind.VariableStatement)
      if (!statement) return false
      const declarationList = statement.getDeclarationList()
      const kind = declarationList.getDeclarationKind()
      const block = statement.getFirstAncestorByKind(SyntaxKind.Block)
      if (!block) return false

      const statements = block.getStatements()
      const statementIndex = statements.findIndex((stmt) => stmt === statement)
      if (statementIndex === -1) return false

      const inserts = []

      if (remaining.length > 0) {
        const bindingText = remaining.map((el) => el.getText()).join(', ')
        inserts.push(`${kind} { ${bindingText} } = ${initializerText}`)
      }

      inserts.push(`${kind} policyKey = usePolicyKey()`)

      block.insertStatements(statementIndex, inserts)
      statement.remove()
      return true
    }
  }

  return false
}

function ensureUsePolicyKeyImport(sourceFile) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((decl) => decl.getModuleSpecifierValue() === targetImportPath)

  if (existing) {
    const hasNamed = existing
      .getNamedImports()
      .some((named) => named.getName() === 'usePolicyKey')
    if (!hasNamed) {
      existing.addNamedImport('usePolicyKey')
    }
    return
  }

  sourceFile.addImportDeclaration({
    moduleSpecifier: targetImportPath,
    namedImports: ['usePolicyKey'],
  })
}

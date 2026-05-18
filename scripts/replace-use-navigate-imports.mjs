#!/usr/bin/env node
import path from 'node:path'
import { Project, QuoteKind, SyntaxKind } from 'ts-morph'

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
const targetImportPath = process.argv[3] || '@/router'
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
  path.join(rootDir, '**/*.js'),
  path.join(rootDir, '**/*.jsx'),
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

  const changed = rewriteSourceFile(sourceFile)

  if (changed === 'changed') {
    summary.changed += 1
    summary.changedFiles.push(path.relative(rootDir, sourceFile.getFilePath()))
    continue
  }

  if (changed === 'skipped') {
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

if (summary.changedFiles.length > 0) {
  console.log('已修改文件:')
  for (const file of summary.changedFiles) {
    console.log(`- ${file}`)
  }
}

if (summary.skippedFiles.length > 0) {
  console.log('跳过文件:')
  for (const file of summary.skippedFiles) {
    console.log(`- ${file}`)
  }
}

function rewriteSourceFile(sourceFile) {
  const filePath = sourceFile.getFilePath()

  if (filePath.endsWith(`${path.sep}src${path.sep}router${path.sep}useAppNavigate.ts`)) {
    return 'skipped'
  }

  const existingTargetImport = sourceFile
    .getImportDeclarations()
    .find((decl) => decl.getModuleSpecifierValue() === targetImportPath)

  const alreadyHasAliasedImport = existingTargetImport
    ?.getNamedImports()
    .some(
      (named) =>
        named.getName() === 'useAppNavigate' &&
        named.getAliasNode()?.getText() === 'useNavigate',
    )

  if (alreadyHasAliasedImport) {
    return 'skipped'
  }

  const tanstackImports = sourceFile
    .getImportDeclarations()
    .filter(
      (decl) => decl.getModuleSpecifierValue() === '@tanstack/react-router',
    )

  if (tanstackImports.length === 0) {
    return 'unchanged'
  }

  let touched = false

  for (const importDecl of tanstackImports) {
    const namedImports = importDecl.getNamedImports()
    const useNavigateImport = namedImports.find((named) => {
      return (
        named.getName() === 'useNavigate' &&
        named.getAliasNode() == null
      )
    })

    if (!useNavigateImport) {
      continue
    }

    touched = true
    useNavigateImport.remove()

    if (importDecl.getNamedImports().length === 0 && !importDecl.getDefaultImport()) {
      importDecl.remove()
    }
  }

  if (!touched) {
    return 'unchanged'
  }

  const targetImport =
    sourceFile
      .getImportDeclarations()
      .find((decl) => decl.getModuleSpecifierValue() === targetImportPath) ||
    sourceFile.addImportDeclaration({
      moduleSpecifier: targetImportPath,
      namedImports: [],
    })

  const hasAliasedImportNow = targetImport
    .getNamedImports()
    .some(
      (named) =>
        named.getName() === 'useAppNavigate' &&
        named.getAliasNode()?.getText() === 'useNavigate',
    )

  if (!hasAliasedImportNow) {
    targetImport.addNamedImport({
      name: 'useAppNavigate',
      alias: 'useNavigate',
    })
  }

  normalizeImportOrder(sourceFile)
  return dryRun ? 'changed' : 'changed'
}

function normalizeImportOrder(sourceFile) {
  const imports = sourceFile.getImportDeclarations()

  imports.sort((a, b) => {
    const aText = a.getModuleSpecifierValue()
    const bText = b.getModuleSpecifierValue()
    return aText.localeCompare(bText)
  })

  const statements = sourceFile.getStatements()
  const importStatements = statements.filter((stmt) => stmt.getKind() === SyntaxKind.ImportDeclaration)

  if (importStatements.length <= 1) {
    return
  }
}

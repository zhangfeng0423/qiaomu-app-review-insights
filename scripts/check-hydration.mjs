#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

const ISSUES = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (/\.(tsx|jsx)$/.test(file)) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const relPath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Rule 1: Check root layout html/body suppressHydrationWarning
  if (relPath.includes('layout.tsx')) {
    if (content.includes('<html') && !content.includes('<html lang="zh-CN" suppressHydrationWarning') && !/<html[^>]*suppressHydrationWarning/.test(content)) {
      ISSUES.push({
        file: relPath,
        line: 1,
        rule: 'ROOT_LAYOUT_HTML_SUPPRESS',
        message: '<html> 标签缺少 suppressHydrationWarning，可能被浏览器扩展注入属性引发水合报错。',
      });
    }
    if (content.includes('<body') && !/<body[^>]*suppressHydrationWarning/.test(content)) {
      ISSUES.push({
        file: relPath,
        line: 1,
        rule: 'ROOT_LAYOUT_BODY_SUPPRESS',
        message: '<body> 标签缺少 suppressHydrationWarning，极易被 Chrome/插件注入属性（如 cz-shortcut-listen）引发水合报错。',
      });
    }
  }

  // Rule 2: typeof window or sessionStorage/localStorage read outside useEffect
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('typeof window !== \'undefined\'') || line.includes('typeof window != "undefined"')) {
      // Check if inside useEffect or a function called in useEffect
      const context = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 5)).join('\n');
      if (!context.includes('useEffect') && !context.includes('// allow-hydration-window')) {
        ISSUES.push({
          file: relPath,
          line: i + 1,
          rule: 'WINDOW_CHECK_IN_RENDER',
          message: '检测到在渲染上下文使用 typeof window 判断。这会导致服务端与客户端初次渲染分支不一致，请移至 useEffect 中。',
        });
      }
    }

    // Rule 3: Invalid HTML nesting - e.g. <h1-6> containing <div> or <p> containing <div>
    if (/<(h[1-6]|p)[^>]*>.*<div/i.test(line)) {
      ISSUES.push({
        file: relPath,
        line: i + 1,
        rule: 'INVALID_HTML_NESTING',
        message: '检测到非法 HTML 标签嵌套（例如 <h*> 或 <p> 内部直接包含 <div>），浏览器会自动强行闭合外层标签破坏 DOM 树。请改用 <span> 或 CSS block。',
      });
    }
  }
}

console.log('🔍 开始全量扫描 Next.js SSR 水合风险 (Hydration Risk Check)...');
walk(SRC_DIR);

if (ISSUES.length === 0) {
  console.log('✅ 检查通过！未发现高危水合反模式 (0 issues found).');
  process.exit(0);
} else {
  console.log(`❌ 发现 ${ISSUES.length} 处潜在水合风险：\n`);
  for (const issue of ISSUES) {
    console.log(`  [${issue.rule}] ${issue.file}:${issue.line}`);
    console.log(`  👉 ${issue.message}\n`);
  }
  process.exit(1);
}

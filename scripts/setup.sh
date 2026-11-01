#!/bin/bash

# AppStore 评论分析系统开发环境设置脚本

echo "🛠 设置 AppStore 评论分析系统开发环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 请先安装 Node.js (推荐版本 18+)"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本: $NODE_VERSION"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 错误: pnpm 未找到，请先安装 pnpm (npm install -g pnpm 或 corepack enable)"
    exit 1
fi

PNPM_VERSION=$(pnpm -v)
echo "✅ pnpm 版本: $PNPM_VERSION"

# 安装依赖
echo "📦 安装项目依赖..."
pnpm install

if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功"
else
    echo "❌ 依赖安装失败"
    exit 1
fi

# 创建环境变量文件
if [ ! -f ".env.local" ]; then
    echo "📝 创建环境变量文件..."
    cp .env.example .env.local
    echo "✅ 已创建 .env.local 文件"
    echo "⚠️  请编辑 .env.local 文件，配置必要的环境变量"
else
    echo "✅ .env.local 文件已存在"
fi

# 创建数据目录
if [ ! -d "src/data" ]; then
    echo "📁 创建数据目录..."
    mkdir -p src/data
    echo "✅ 数据目录创建成功"
else
    echo "✅ 数据目录已存在"
fi

# 检查环境变量
echo "🔍 检查环境变量配置..."
if [ -f ".env.local" ]; then
    if grep -q "MOONSHOT_API_KEY=" .env.local; then
        if grep -q "MOONSHOT_API_KEY=your_moonshot_api_key_here" .env.local; then
            echo "⚠️  请在 .env.local 中配置真实的 MOONSHOT_API_KEY"
        else
            echo "✅ MOONSHOT_API_KEY 已配置"
        fi
    else
        echo "⚠️  请在 .env.local 中添加 MOONSHOT_API_KEY"
    fi
fi

echo ""
echo "🎉 开发环境设置完成！"
echo ""
echo "📋 设置清单:"
echo "  ✅ Node.js 和 pnpm 检查通过"
echo "  ✅ 项目依赖安装完成"
echo "  ✅ 环境变量文件已创建"
echo "  ✅ 数据目录已创建"
echo ""
echo "🚀 启动开发服务器:"
echo "  pnpm dev"
echo ""
echo "🌐 访问地址:"
echo "  http://localhost:3000"
echo ""
echo "📚 更多信息请查看 README.md"

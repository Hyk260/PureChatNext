/**
 * Curated community skills. Pick entries from scripts/community/generated/skills.data.ts
 * (`pnpm skills:sync`). Sync does not overwrite this file.
 */
import type { DiscoverSkillItem } from '@/features/community/types'

export const COMMUNITY_SKILLS_DATA = [
  {
    "author": "openclaw",
    "category": "coding-agents-ides",
    "description": "创建、编辑、改进或审计 AgentSkills。在从头创建新技能时，或在被要求改进、审查、审计、整理或清理现有技能或 SKILL.md 文件时使用。也用于编辑或重构技能目录（将文件移动到 references/ 或 scripts/、删除过时内容、根据 AgentSkills 规范进行验证）。在出现类似“创建技能”、“撰写技能”、“整理技能”、“改进此技能”、“审查该技能”、“清理该技能”、“审计该技能”等短语时触发。",
    "identifier": "openclaw-openclaw-skill-creator",
    "name": "skill-creator",
    "updatedAt": "2026-09-22T04:55:49.606Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/skill-creator",
    "icon": "https://github.com/openclaw.png",
    "license": "Apache-2.0",
    "resourcesCount": 6,
    "version": "1.0.2"
  },
  {
    "author": "Panniantong",
    "category": "search-research",
    "description": "为你的 AI 代理提供看遍全网的“眼睛”。可搜索并阅读 16 个平台：Twitter/X、Reddit、YouTube、GitHub、哔哩哔哩（B站）、小红书、抖音、微博、微信文章、小宇宙播客、LinkedIn、Instagram、V2EX、RSS、Exa 网页搜索以及任意网页。8 个通道为零配置。适用于用户要求在任何受支持平台上搜索、阅读或交互时，分享 URL，或要求网页搜索时使用。触发词：\"搜推特\", \"搜小红书\", \"看视频\", \"搜一下\", \"上网搜\", \"帮我查\", \"搜索 Twitter\", \"YouTube 字幕/转录\", \"搜索 Reddit\", \"读取此链接\", \"B站\", \"bilibili\", \"抖音视频\", \"微信文章\", \"公众号\", \"微博\", \"V2EX\", \"小宇宙\", \"播客\", \"网页搜索\", \"研究\", \"帮我安装\"。",
    "identifier": "panniantong-agent-reach-skill",
    "name": "agent-reach",
    "updatedAt": "2026-09-16T23:37:25.441Z",
    "github": {
      "stars": 10205,
      "url": "https://github.com/Panniantong/Agent-Reach"
    },
    "homepage": "https://github.com/Panniantong/Agent-Reach/tree/main/agent_reach/skill",
    "icon": "https://github.com/Panniantong.png",
    "version": "1.0.2"
  },
  {
    "author": "firecrawl",
    "category": "search-research",
    "description": "带有整页内容提取的网页搜索。每当用户要求搜索网络、查找文章、研究某个主题、查阅信息、寻找最新新闻、发现来源，或者说“搜索”、“帮我找”、“查一下”、“人们在说什么”或“查找关于……的文章”时，请使用此技能。返回真实的搜索结果并可选择整页 Markdown —— 不仅仅是片段。提供比 Claude 内置 WebSearch 更强的功能。",
    "identifier": "firecrawl-cli-firecrawl-search",
    "name": "firecrawl-search",
    "updatedAt": "2026-09-20T22:09:47.729Z",
    "github": {
      "stars": 191,
      "url": "https://github.com/firecrawl/cli"
    },
    "homepage": "https://github.com/firecrawl/cli/tree/main/skills/firecrawl-search",
    "icon": "https://github.com/firecrawl.png",
    "version": "1.0.2"
  },
  {
    "author": "vercel-labs",
    "category": "browser-automation",
    "description": "用于 AI 代理的浏览器自动化 CLI。当用户需要与网站交互时使用，包括导航页面、填写表单、点击按钮、截屏、提取数据、测试 Web 应用或自动执行任何浏览器任务。触发示例包括 \"打开网站\"、\"填写表单\"、\"点击按钮\"、\"截取屏幕\"、\"从页面抓取数据\"、\"测试此 Web 应用\"、\"登录站点\"、\"自动化浏览器操作\"，或任何需要以编程方式进行网页交互的任务。",
    "identifier": "vercel-labs-agent-browser-agent-browser",
    "name": "agent-browser",
    "updatedAt": "2026-09-16T17:20:47.665Z",
    "github": {
      "stars": 19847,
      "url": "https://github.com/vercel-labs/agent-browser"
    },
    "homepage": "https://github.com/vercel-labs/agent-browser/tree/main/skills/agent-browser",
    "icon": "https://github.com/vercel-labs.png",
    "resourcesCount": 10,
    "version": "1.0.3"
  },
  {
    "author": "MiniMax-AI",
    "category": "productivity-tasks",
    "description": "生成、编辑和读取 PowerPoint 演示文稿。可使用 PptxGenJS 从头创建（封面、目录、正文、章节分隔、总结幻灯片），通过 XML 工作流编辑现有 PPTX，或使用 markitdown 提取文本。触发词：PPT、PPTX、PowerPoint、演示文稿、幻灯片、幻灯片集、幻灯片。",
    "identifier": "minimax-ai-skills-pptx-generator",
    "name": "pptx-generator",
    "updatedAt": "2026-09-22T03:39:16.016Z",
    "github": {
      "stars": 1157,
      "url": "https://github.com/MiniMax-AI/skills"
    },
    "homepage": "https://github.com/MiniMax-AI/skills/tree/main/skills/pptx-generator",
    "icon": "https://github.com/MiniMax-AI.png",
    "license": "MIT",
    "resourcesCount": 5,
    "version": "1.0.1"
  },
  {
    "author": "davila7",
    "category": "ai-llms",
    "description": "将文件和办公文档转换为 Markdown。支持 PDF、DOCX、PPTX、XLSX、图像（含 OCR）、音频（含转录）、HTML、CSV、JSON、XML、ZIP、YouTube 链接、EPUB 等。",
    "identifier": "davila7-claude-code-templates-markitdown",
    "name": "markitdown",
    "updatedAt": "2026-09-19T02:51:57.375Z",
    "github": {
      "stars": 22008,
      "url": "https://github.com/davila7/claude-code-templates"
    },
    "homepage": "https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/skills/scientific/markitdown",
    "icon": "https://github.com/davila7.png",
    "license": "MIT",
    "resourcesCount": 12,
    "version": "1.0.2"
  },
  {
    "author": "bytedance",
    "category": "cli-utilities",
    "description": "当用户询问「我该如何做某事」「找一个能做某事的技能」「有没有技能可以……」，或表示想扩展能力时，帮助发现并安装 Agent 技能。用户在寻找可能以可安装技能形式存在的功能时使用此技能。",
    "identifier": "bytedance-deer-flow-find-skills",
    "name": "find-skills",
    "updatedAt": "2026-09-17T01:16:25.294Z",
    "github": {
      "stars": 29267,
      "url": "https://github.com/bytedance/deer-flow"
    },
    "homepage": "https://github.com/bytedance/deer-flow/tree/main/skills/public/find-skills",
    "icon": "https://github.com/bytedance.png",
    "resourcesCount": 1,
    "version": "1.0.1"
  },
  {
    "author": "openclaw",
    "category": "cli-utilities",
    "description": "通过 wttr.in 或 Open-Meteo 获取当前天气和预报。使用场景：用户询问任意地点的天气、气温或预报时。非适用场景：历史天气数据、重大气象警报或详细气象分析。无需 API 密钥。",
    "identifier": "openclaw-openclaw-weather",
    "name": "weather",
    "updatedAt": "2026-09-21T08:35:58.827Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/weather",
    "icon": "https://github.com/openclaw.png",
    "isFeatured": true,
    "version": "1.0.2"
  },
  {
    "author": "openclaw",
    "category": "git-github",
    "description": "通过 `gh` CLI 执行 GitHub 操作：issues、PR、CI 运行、代码审查、API 查询。适用场景：(1) 检查 PR 状态或 CI，(2) 创建/评论 issue，(3) 列表/过滤 PR 或 issue，(4) 查看运行日志。不适用于：需要手动浏览器流程的复杂网页 UI 交互（有浏览器工具时请使用），跨大量仓库的批量操作（请用 `gh api` 编写脚本），或 `gh auth` 未配置时。",
    "identifier": "openclaw-openclaw-github",
    "name": "github",
    "updatedAt": "2026-09-16T18:44:36.244Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/github",
    "icon": "https://github.com/openclaw.png",
    "isFeatured": true,
    "version": "1.0.2"
  },
  {
    "author": "davila7",
    "category": "communication",
    "description": "去除文本中的 AI 生成痕迹。在编辑或审阅文本、使其读起来更自然、更像人写的时候使用。基于维基百科的「AI 写作特征」指南，检测并修正夸大象征、促销腔、肤浅分析、含糊归因、破折号滥用、三段式、AI 常用词、否定平行结构和过多连接短语。原技能作者 @blader：https://github.com/blader/humanizer",
    "identifier": "davila7-claude-code-templates-humanizer",
    "name": "humanizer",
    "updatedAt": "2026-09-16T23:37:42.925Z",
    "github": {
      "stars": 20164,
      "url": "https://github.com/davila7/claude-code-templates"
    },
    "homepage": "https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/skills/productivity/humanizer",
    "icon": "https://github.com/davila7.png",
    "resourcesCount": 1,
    "version": "2.1.1"
  },
  {
    "author": "ComposioHQ",
    "category": "transportation",
    "description": "通过 Rube MCP（Composio）自动化 Google Maps 任务：地址地理编码、地点搜索、路线规划、路线矩阵计算、反向地理编码、自动补全和地点详情。使用前先搜索工具以获取当前参数结构。",
    "identifier": "composiohq-awesome-claude-skills-google-maps-automation",
    "name": "google-maps-automation",
    "updatedAt": "2026-09-16T02:39:11.663Z",
    "github": {
      "stars": 42914,
      "url": "https://github.com/ComposioHQ/awesome-claude-skills"
    },
    "homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/composio-skills/google-maps-automation",
    "icon": "https://github.com/ComposioHQ.png",
    "version": "1.0.1"
  },
  {
    "author": "anthropics",
    "category": "pdf-documents",
    "description": "任何涉及 .pptx 或 .potx 文件（作为输入、输出或两者）的情况都可以使用此技能。适用场景包括：创建幻灯片集、宣讲稿或演示文稿；从任何 .pptx 或 .potx 文件读取、解析或提取文本（即使提取内容将用于其他地方，如邮件或摘要）；编辑、修改或更新现有演示文稿；合并或拆分幻灯片文件；处理模板（.potx）、布局、演讲者备注或评论。只要用户提到“幻灯片集”、“幻灯片”、“演示文稿”，或引用 .pptx 或 .potx 文件名，不论他们之后打算如何使用内容，都应触发该技能。如果需要打开、创建或接触 .pptx 或 .potx 文件，请使用此技能。",
    "identifier": "anthropics-skills-pptx",
    "name": "pptx",
    "updatedAt": "2026-09-22T04:53:52.348Z",
    "github": {
      "stars": 176292,
      "url": "https://github.com/anthropics/skills"
    },
    "homepage": "https://github.com/anthropics/skills/tree/main/skills/pptx",
    "icon": "https://github.com/anthropics.png",
    "isFeatured": true,
    "license": "Proprietary",
    "resourcesCount": 55,
    "version": "1.0.5"
  },
  {
    "author": "anthropics",
    "category": "pdf-documents",
    "description": "当电子表格文件是主要输入或输出时，请使用此技能。也就是说，任何用户想要打开、读取、编辑或修复现有 .xlsx、.xlsm、.xltx、.csv 或 .tsv 文件（例如：添加列、计算公式、格式化、制图、清理混乱数据）；从头或从其他数据源创建新的电子表格；或在表格文件格式之间转换的任务均适用。尤其在用户按名称或路径引用某个电子表格文件时（即使是随意提及，例如 \"我的下载里的 xlsx\"）并希望对其执行操作或产出结果时要触发。另外，对于将混乱的表格数据文件（格式错误的行、错位的表头、垃圾数据）清理或重构为正规电子表格的情况也要触发。交付物必须是电子表格文件。主要交付物为 Word 文档、HTML 报告、独立 Python 脚本、数据库流水线或 Google Sheets API 集成时不要触发，即使涉及表格数据也不例外。",
    "identifier": "anthropics-skills-xlsx",
    "name": "xlsx",
    "updatedAt": "2026-09-22T04:54:50.143Z",
    "github": {
      "stars": 176292,
      "url": "https://github.com/anthropics/skills"
    },
    "homepage": "https://github.com/anthropics/skills/tree/main/skills/xlsx",
    "icon": "https://github.com/anthropics.png",
    "isFeatured": true,
    "license": "Proprietary",
    "resourcesCount": 52,
    "version": "1.0.5"
  },
  {
    "author": "anthropics",
    "category": "pdf-documents",
    "description": "当用户想对 PDF 文件进行任何操作时，请使用此技能。这包括从 PDF 中阅读或提取文本/表格、将多个 PDF 合并为一个、拆分 PDF、旋转页面、添加水印、创建新 PDF、填写 PDF 表单、加密/解密 PDF、提取图像以及对扫描的 PDF 进行 OCR 以使其可搜索。如果用户提到 .pdf 文件或要求生成 PDF，请使用此技能。",
    "identifier": "anthropics-skills-pdf",
    "name": "pdf",
    "updatedAt": "2026-09-22T02:03:00.974Z",
    "github": {
      "stars": 176292,
      "url": "https://github.com/anthropics/skills"
    },
    "homepage": "https://github.com/anthropics/skills/tree/main/skills/pdf",
    "icon": "https://github.com/anthropics.png",
    "isFeatured": true,
    "license": "Proprietary",
    "resourcesCount": 11,
    "version": "1.0.5"
  },
  {
    "author": "anthropics",
    "category": "pdf-documents",
    "description": "当用户想要创建、读取、编辑或操作 Word 文档（.docx 文件）或 Word 模板（.dotx 文件）时，请使用此技能。触发场景包括：任何提及“Word doc”、“word document”、“.docx”、“.dotx”，或请求生成具有目录、标题、页码或信头等格式的专业文档的情况。还应在从 .docx 或 .dotx 文件中提取或重组内容、在文档中插入或替换图像、在 Word 文件中执行查找与替换、处理修订或注释、或将内容转换为格式化良好的 Word 文档时使用。如果用户要求以 Word 或 .docx 文件形式交付“报告”、“备忘录”、“信件”、“模板”或类似成果，也请使用此技能。不要用于 PDF、电子表格、Google 文档或与文档生成无关的一般编码任务。",
    "identifier": "anthropics-skills-docx",
    "name": "docx",
    "updatedAt": "2026-09-22T02:02:56.643Z",
    "github": {
      "stars": 176292,
      "url": "https://github.com/anthropics/skills"
    },
    "homepage": "https://github.com/anthropics/skills/tree/main/skills/docx",
    "icon": "https://github.com/anthropics.png",
    "isFeatured": true,
    "license": "Proprietary",
    "resourcesCount": 60,
    "version": "1.0.5"
  },
  {
    "author": "affaan-m",
    "category": "health-fitness",
    "description": "医疗应用中EMR/EHR的开发模式，涵盖临床安全、就诊工作流、处方生成、临床决策支持集成及以可访问性为先的医疗数据录入用户界面。",
    "identifier": "affaan-m-ecc-healthcare-emr-patterns",
    "name": "healthcare-emr-patterns",
    "updatedAt": "2026-09-16T02:10:03.480Z",
    "github": {
      "stars": 186895,
      "url": "https://github.com/affaan-m/ECC"
    },
    "homepage": "https://github.com/affaan-m/ECC/tree/main/docs/ja-JP/skills/healthcare-emr-patterns",
    "icon": "https://github.com/affaan-m.png",
    "version": "1.0.0"
  },
  {
    "author": "openclaw",
    "category": "notes-pkm",
    "description": "处理 Obsidian 存储库（纯 Markdown 笔记），并通过 obsidian-cli 实现自动化。",
    "identifier": "openclaw-openclaw-obsidian",
    "name": "obsidian",
    "updatedAt": "2026-09-16T11:08:58.151Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/obsidian",
    "icon": "https://github.com/openclaw.png",
    "isFeatured": true,
    "version": "1.0.3"
  },
  {
    "author": "ComposioHQ",
    "category": "calendar-scheduling",
    "description": "通过 Rube MCP（Composio）自动化 Cal 日程任务。使用前先搜索工具以获取当前参数结构。",
    "identifier": "composiohq-awesome-claude-skills-cal-automation",
    "name": "cal-automation",
    "updatedAt": "2026-09-16T02:34:41.961Z",
    "github": {
      "stars": 42914,
      "url": "https://github.com/ComposioHQ/awesome-claude-skills"
    },
    "homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/composio-skills/cal-automation",
    "icon": "https://github.com/ComposioHQ.png",
    "version": "1.0.1"
  },
  {
    "author": "a18515373115-droid",
    "category": "personal-development",
    "description": "张雪峰的思维框架与表达方式。基于5本著作、15+篇权威媒体深度采访、\n30+条一手语录、11个关键决策记录和完整人生时间线的深度调研，\n提炼5个核心心智模型、8条决策启发式和完整的表达DNA。\n用途：作为思维顾问，用张雪峰的视角分析教育选择、职业规划、阶层流动等问题。\n当用户提到「用张雪峰的视角」「张雪峰会怎么看」「张雪峰模式」「雪峰视角」时使用。\n即使用户只是说「帮我用张雪峰的角度想想」「如果张雪峰会怎么说」「切换到张雪峰」也应触发。",
    "identifier": "a18515373115-droid-zhangxuefeng-skill",
    "name": "张雪峰-skill",
    "updatedAt": "2026-09-14T17:05:04.159Z",
    "github": {
      "stars": 0,
      "url": "https://github.com/a18515373115-droid/ZhangXueFeng-skill"
    },
    "homepage": "https://github.com/a18515373115-droid/ZhangXueFeng-skill",
    "icon": "https://github.com/a18515373115-droid.png",
    "license": "MIT",
    "resourcesCount": 10,
    "version": "2.0"
  },
  {
    "author": "openclaw",
    "category": "speech-transcription",
    "description": "使用 Whisper CLI 本地进行语音转文本（无需 API 密钥）。",
    "identifier": "openclaw-openclaw-openai-whisper",
    "name": "openai-whisper",
    "updatedAt": "2026-09-16T16:44:23.013Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/openai-whisper",
    "icon": "https://github.com/openclaw.png",
    "isFeatured": true,
    "version": "1.0.2"
  },
  {
    "author": "openclaw",
    "category": "apple-apps-services",
    "description": "通过 macOS 上的 `memo` 命令行工具管理 Apple 备忘录（创建、查看、编辑、删除、搜索、移动和导出笔记）。当用户请求 OpenClaw 添加笔记、列出笔记、搜索笔记或管理笔记文件夹时使用。",
    "identifier": "openclaw-openclaw-apple-notes",
    "name": "apple-notes",
    "updatedAt": "2026-09-16T08:25:36.005Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/apple-notes",
    "icon": "https://github.com/openclaw.png",
    "version": "1.0.3"
  },
  {
    "author": "openclaw",
    "category": "smart-home-iot",
    "description": "控制 Eight Sleep pod（状态、温度、闹钟、日程）。",
    "identifier": "openclaw-openclaw-eightctl",
    "name": "eightctl",
    "updatedAt": "2026-09-16T02:10:37.592Z",
    "github": {
      "stars": 340209,
      "url": "https://github.com/openclaw/openclaw"
    },
    "homepage": "https://github.com/openclaw/openclaw/tree/main/skills/eightctl",
    "icon": "https://github.com/openclaw.png",
    "version": "1.0.3"
  },
  {
    "author": "wshobson",
    "category": "gaming",
    "description": "掌握 Godot 4 的 GDScript 设计模式，包括信号、场景、状态机和优化。适用于构建 Godot 游戏、实现游戏系统或学习 GDScript 的最佳实践。",
    "identifier": "wshobson-agents-godot-gdscript-patterns",
    "name": "godot-gdscript-patterns",
    "updatedAt": "2026-09-16T02:31:30.570Z",
    "github": {
      "stars": 30327,
      "url": "https://github.com/wshobson/agents"
    },
    "homepage": "https://github.com/wshobson/agents/tree/main/plugins/game-development/skills/godot-gdscript-patterns",
    "icon": "https://github.com/wshobson.png",
    "version": "1.0.3"
  },
  {
    "author": "Aradotso",
    "category": "self-hosted-automation",
    "description": "Nous Research Hermes Agent 的精选生态指南，涵盖自改进 AI 代理的技能、记忆、多平台消息和 MCP 集成。当用户要安装或配置 Hermes、添加技能、部署集成，或在 Telegram、Discord 上使用 Hermes 时使用。",
    "identifier": "aradotso-trending-skills-awesome-hermes-agent",
    "name": "Awesome Hermes Agent",
    "updatedAt": "2026-09-15T15:53:19.444Z",
    "github": {
      "stars": 15,
      "url": "https://github.com/Aradotso/trending-skills"
    },
    "homepage": "https://github.com/Aradotso/trending-skills/tree/main/skills/awesome-hermes-agent",
    "icon": "https://github.com/Aradotso.png",
    "version": "1.0.1"
  },
  {
    "author": "LingoJack",
    "category": "ios-macos-development",
    "description": "iOS 应用 Swift 原生开发技能包；当用户描述开发 iOS 原生应用的需求时加载此技能。",
    "identifier": "lingojack-j-swift-ios-app-gen",
    "name": "swift-ios-app-gen",
    "updatedAt": "2026-09-16T11:30:41.508Z",
    "github": {
      "stars": 1,
      "url": "https://github.com/LingoJack/j"
    },
    "homepage": "https://github.com/LingoJack/j/tree/main/assets/skills/swift-ios-app-gen",
    "icon": "https://github.com/LingoJack.png",
    "version": "1.0.1"
  },
  {
    "author": "davila7",
    "category": "data-analytics",
    "description": "分析 Excel 电子表格、创建透视表、生成图表并执行数据分析。在分析 Excel 文件、电子表格、表格式数据或 .xlsx 文件时使用。",
    "identifier": "davila7-claude-code-templates-excel-analysis",
    "name": "Excel Analysis",
    "updatedAt": "2026-09-16T05:38:49.702Z",
    "github": {
      "stars": 22008,
      "url": "https://github.com/davila7/claude-code-templates"
    },
    "homepage": "https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/skills/enterprise-communication/excel-analysis",
    "icon": "https://github.com/davila7.png",
    "version": "1.0.2"
  },
  {
    "author": "sickn33",
    "category": "finance",
    "description": "构建金融模型，回测交易策略并分析市场数据。实现风险度量、投资组合优化和统计套利。对于量化金融、交易算法或风险分析，请积极主动地使用。",
    "identifier": "sickn33-antigravity-awesome-skills-quant-analyst",
    "name": "quant-analyst",
    "updatedAt": "2026-09-15T15:37:02.150Z",
    "github": {
      "stars": 8567,
      "url": "https://github.com/sickn33/antigravity-awesome-skills"
    },
    "homepage": "https://github.com/sickn33/antigravity-awesome-skills/tree/main/skills/quant-analyst",
    "icon": "https://github.com/sickn33.png",
    "version": "1.0.1"
  }
] as DiscoverSkillItem[]

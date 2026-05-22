# Mira Demo 功能视图与 UI 规范文档

> 目的：作为前端 Demo 复现的设计基准，开发者无需查看源码即可按此文档完整复现。

---

## 一、全局架构

### 1.1 技术栈

| 类目       | 选型                                      |
| ---------- | ----------------------------------------- |
| 框架       | React 18 (UMD CDN)                       |
| 编译       | Babel Standalone (in-browser 编译)        |
| UI 库      | Ant Design 5.20                           |
| 日期       | dayjs 1.11.10 + weekOfYear/isoWeek/customParseFormat/zh-cn |
| 图表       | ECharts 5.5.1（已引入未使用，预留）       |
| Markdown   | marked 12.0.0                             |
| 持久化     | localStorage (key: `mira_app_state_v4`)   |
| 状态管理   | React Context + Provider 模式             |

### 1.2 页面结构总览

```
App
├── ConfigProvider (antd 主题)
└── StoreProvider
    └── MainLayout
        ├── Header (顶部品牌栏)
        ├── Sider (左侧边栏)
        │   ├── 用户信息 + 视角切换
        │   ├── 菜单项列表
        │   └── 底部品牌标语
        └── Content
            └── RouteRenderer → 根据state.route渲染页面
                ├── TasksPage (随手记)
                ├── ReportPage (写总结)
                ├── WikiPage (工作库)
                ├── AskMiraPage (问Mira)
                └── TalentPoolPage (人才库)
```

### 1.3 路由映射

| route 值   | 页面组件         | 菜单标签 | 菜单图标 | 个人视角 | 管理视角 |
| ---------- | ---------------- | -------- | -------- | -------- | -------- |
| `tasks`    | TasksPage        | 随手记   | ✅       | ✅       | ✅       |
| `report`   | ReportPage       | 写总结   | 📝       | ✅       | ✅       |
| `wiki`     | WikiPage         | 工作库   | 📚       | ✅       | ✅       |
| `ask`      | AskMiraPage      | 问Mira   | 🪞       | ✅       | ✅       |
| `talent`   | TalentPoolPage   | 人才库   | 👥       | ❌       | ✅       |

> 默认路由 `tasks`。视角切换时不改变路由，仅影响菜单可见性。

---

## 二、状态管理

### 2.1 全局状态结构

```typescript
interface AppState {
  tasks: Task[];           // 所有任务
  projects: Project[];     // 项目列表
  route: string;           // 当前路由 key
  chatHistory: ChatMsg[];  // 问Mira 对话历史
  wikiChatHistory: ChatMsg[]; // 工作库对话历史
}

interface Task {
  id: string;              // 8位随机字符串
  weekKey: string;         // "GGGG-[W]WW" 格式
  projectId: string;       // 关联项目ID
  title: string;           // 标题
  detail?: string;         // 详情
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate: string;         // YYYY-MM-DD
  done: boolean;           // 完成状态
  tags: string[];          // 类型标签
  createdAt: number;       // 时间戳
  finishedAt: number | null; // 完成时间戳
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  time: number;
  sources?: SourceCard[];  // 仅 AskMira
}

interface SourceCard {
  type: string;   // "任务"
  text: string;   // 任务标题
  status: string; // "已完成" | "进行中"
}
```

### 2.2 Actions 列表

| Action            | 参数              | 说明                                     |
| ----------------- | ----------------- | ---------------------------------------- |
| `setRoute`        | route: string     | 切换页面                                 |
| `addTask`         | task: Partial     | 新建任务（自动生成id/createdAt/weekKey）  |
| `updateTask`      | id, patch: Partial| 更新任务（done→true时自动设finishedAt）   |
| `removeTask`      | id: string        | 删除任务                                 |
| `addChatMessage`  | msg: ChatMsg      | 追加问Mira对话                           |
| `clearChat`       | -                 | 清空问Mira对话                           |
| `addWikiChatMessage` | msg: ChatMsg   | 追加工作库对话                           |
| `clearWikiChat`   | -                 | 清空工作库对话                           |
| `resetAll`        | -                 | 清除localStorage并刷新页面               |

### 2.3 持久化

- **Key**: `mira_app_state_v4`
- **写入时机**: 每次 state 变更 (useEffect 监听)
- **读取时机**: 应用初始化 (useState 工厂函数)
- **兼容处理**: 加载旧数据时补全 `route='tasks'`、`projects=PROJECTS`、`chatHistory=[]`、`wikiChatHistory=[]`，且用 `Array.isArray()` 检查

### 2.4 种子数据生成

首次加载无 localStorage 数据时，调用 `buildSeed()` 生成：
- 8周历史任务（`generateHistoryTasks(8)`），每周2-5条，随机项目/关键词/优先级/完成状态
- 8条当周固定任务（`generateCurrentTasks()`），覆盖5个项目
- 初始路由 `tasks`，空对话历史

---

## 三、数据模型（常量定义）

### 3.1 项目 PROJECTS

| id  | name                     | color   | icon |
| --- | ------------------------ | ------- | ---- |
| p1  | 某国有大行数字化转型咨询 | #1B2A4E | 🏦   |
| p2  | 某股份制银行智能风控项目 | #E8B86D | 🛡️   |
| p3  | 某城商行运营效能提升     | #52C41A | 📈   |
| p4  | 某农商行客户旅程优化     | #722ED1 | 🗺️   |
| p5  | 某外资银行合规咨询       | #FA541C | 📋   |

### 3.2 关键词词典 KEYWORD_DICT (30项)

`需求调研、方案设计、客户汇报、投标、标书编写、项目立项、里程碑评审、交付物编写、数据分析、流程梳理、组织诊断、运营指标设计、KPI体系搭建、竞品分析、合规审查、风险识别、培训赋能、知识转移、变更管理、干系人沟通、项目复盘、质量检查、资源协调、商务谈判、合同签署、SOP制定、系统对接、UAT测试、上线支持`

### 3.3 优先级 PRIORITIES

| value   | label | Tag color |
| ------- | ----- | --------- |
| low     | 低    | default   |
| normal  | 普通  | blue      |
| high    | 高    | orange    |
| urgent  | 紧急  | red       |

### 3.4 标签维度 TAG_DIMENSIONS

| 维度   | 值列表                                                                 |
| ------ | ---------------------------------------------------------------------- |
| 项目   | PROJECTS.map(p => p.name)                                              |
| 类型   | 需求分析、方案交付、客户沟通、项目管理、投标商务、数据分析、运营优化、合规风控、培训赋能、系统实施 |
| 优先级 | 低、普通、高、紧急                                                     |
| 状态   | 已完成、进行中                                                         |

### 3.5 团队成员 TEAM_MEMBERS

| id  | name   | role     | avatar | color   |
| --- | ------ | -------- | ------ | ------- |
| m1  | 陈思远 | 高级顾问 | 🧑‍💼    | #1B2A4E |
| m2  | 林晓彤 | 咨询顾问 | 👩‍💼    | #E8B86D |
| m3  | 王嘉琪 | 咨询顾问 | 👨‍💻    | #52C41A |
| m4  | 赵明轩 | 初级顾问 | 🧑‍🎓    | #722ED1 |
| m5  | 孙艺涵 | 高级顾问 | 👩‍🔬    | #FA541C |
| m6  | 周文博 | 项目经理 | 🧑‍🔧    | #13C2C2 |

---

## 四、核心算法

### 4.1 确定性任务分配

```javascript
// 为每条任务确定性地分配一个团队成员
function assignTasksToMembers(tasks) {
  const mIds = TEAM_MEMBERS.map(m => m.id);
  return tasks.map(t => ({
    ...t,
    assignee: t.assignee || mIds[Math.abs(hashCode(t.id)) % mIds.length]
  }));
}

// Java 式字符串哈希
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
```

**要点**: 同一 task.id 每次分配结果一致，确保渲染稳定性。

### 4.2 能力标签计算

```javascript
function computeMemberAbilities(memberId, allTasks) {
  // 筛选该成员任务 → 分三维度统计
  // typeCount: tags 出现频次 → top 5 (weight >= 1)
  // projCount: 项目出现频次 → top 3 (weight >= 1)
  // kwCount: KEYWORD_DICT 匹配频次 → top 5 (weight >= 2)
  // 输出: { tags, totalTasks, doneTasks, topTypes, topProj, topKw }
}
```

**标签颜色映射**: `type→gold`, `project→purple`, `keyword→blue`

### 4.3 报告生成算法

#### 个人报告 (`polishReport`)

```
# {项目名-}{日报/周报/月报} — YYYY年M月D日

## 已完成工作
1. **标题**：详情
2. ...

## 待完成工作
1. 标题（详情）
2. ...
```

#### 团队报告 (`generateTeamReport`)

```
# 团队{日报/周报/月报} — YYYY年M月D日

> 圈选成员：张三、李四

## {项目icon} {项目名}

**参与人员：** {avatar} {name}、{avatar} {name}

### 已完成（N项）
- {成员名}：**{标题}**—{详情}

### 进行中（N项）
- {成员名}：{标题}（{详情}）

---

## 团队汇总

- 总任务数：N
- 已完成：N（XX%）
- 进行中：N

**项目分布：**
- {项目}：N项（已完成N项）

**能力分布：**
- {类型}：N项
```

**要点**: 按项目维度分组而非按人分节；每个项目内列出参与人员、已完成/进行中列表（带成员名前缀）。

### 4.4 AI 问答规则（关键词匹配）

#### 问Mira (`AskMiraPage`)

| 用户输入匹配          | 回答逻辑                                                       |
| --------------------- | -------------------------------------------------------------- |
| 任意关键词            | 在 tasks 中搜索 title+detail 包含关键词，返回匹配数+前6条摘要   |
| 无匹配                | "未找到与「{q}」直接相关的记录。试试关键词..."                  |
| 回答附带              | sources: 前3条匹配记录的 {type, text, status}                   |

#### 工作库对话 (`WikiPage`)

| 用户输入匹配                         | 回答逻辑                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| 包含"分类"/"标签"/"归类"            | 统计未打标任务数，按项目分布列举，建议添加标签                   |
| 包含"项目"/"进展"                    | 列举所有项目及任务统计                                          |
| 其他                                 | 同 AskMira 搜索逻辑，返回前5条                                  |
| 无匹配                               | "未找到相关内容。试试\"帮我分类\"或\"项目进展\"。"               |

**模拟延迟**: AskMira 800~1400ms; Wiki 500~900ms

---

## 五、页面交互逻辑

### 5.1 MainLayout（全局布局）

**视角切换**
- Segmented 组件，两个选项：`👤 个人` / `👥 管理`
- 切换时设置路由为 `tasks`（不保留当前页面）
- 管理视角额外显示 `人才库` 菜单项

**菜单交互**
- 点击菜单项 → `actions.setRoute(key)`
- 当前选中项：金色边框 + 金色渐变背景 + 深蓝文字 + 加粗
- 未选中项 hover：浅灰背景 `#F5F7FB`
- 过渡动画 `transition: all 0.15s`

### 5.2 TasksPage（随手记）

**布局**: 左 15/24 + 右 9/24

**顶卡**
- 深蓝渐变背景
- 显示待办数 + 已完成数
- 右侧 80px 半透明 ✅ emoji 水印

**待办列表（左侧）**
- 列表按 createdAt 降序
- 每项显示：Checkbox + 标题 + 详情 + 项目Tag(紫) + 优先级Tag + 类型Tags(金)
- 操作：完成按钮 → 标记done + 底部右角通知；删除按钮 → Popconfirm确认
- 点击行 → 打开编辑 Modal
- 空态：`<Empty description="暂无待办" />`

**已归档（右侧）**
- 列表，标题删除线 + 灰色
- 显示项目icon + 完成日期(MM/DD)
- 最大高度 `calc(100vh - 220px)` 可滚动
- 空态：`<Empty description="暂无已完成事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />`

**新建/编辑 Modal**
- 字段：标题(Input) + 详情(TextArea,3行) + 所属项目(Select) + 优先级(Select,120px) + 截止日期(date Input)
- 保存校验：标题非空
- 默认值：新建时优先级=normal，截止日期=明天

### 5.3 ReportPage（写总结）

**布局**: 双 Tab（个人总结 / 团队总结）+ 三档周期切换（Daily/Weekly/Monthly）

**顶卡**
- 深蓝渐变背景
- 显示当前日期
- 右侧 80px 半透明 📝 emoji 水印
- 两个 Segmented：Tab切换 + 周期切换

**个人总结 Tab**
- 布局：左 13/24 + 右 11/24
- **左列 - 选择工作项**
  - 顶部：项目筛选 Select(200px) + 全选/清空按钮
  - 按完成状态分两组：✅已完成(绿字) / ⏳待完成(橙字)
  - 每项：Checkbox + 标题 + 详情 + 项目Tag
  - 空态：`<Empty description="该时段暂无工作项" />`
- **右列 - 报告预览**
  - 生成按钮(需选中≥1项) + 复制按钮
  - Markdown 渲染预览（白色背景圆角框）
  - 空态：48px 📝 + "勾选左侧工作项后点击生成{周期}报"

**团队总结 Tab**
- 布局：左 13/24 + 右 11/24
- **左列 - 圈选团队成员**
  - 支持多选（Checkbox）
  - 全选/清空按钮
  - 每位成员：Avatar(36px,成员色) + 姓名+角色 + 能力Tags(前3个) + 已完成数
  - 使用 `assignTasksToMembers` 为任务分配成员
- **右列 - 团队报告预览**
  - 生成按钮(需选中≥1人) + 复制按钮
  - 报告按**项目维度**分组汇总（不是按人分节）
  - 每个项目内：参与人员 + 已完成列表(带成员名) + 进行中列表(带成员名)
  - 末尾：团队汇总（总数/完成率/项目分布/能力分布）
  - 空态：48px 👥 + "勾选左侧团队成员后点击生成团队{周期}报"

**周期计算**
- daily: cutoff = 1天前
- weekly: cutoff = 7天前
- monthly: cutoff = 30天前
- 筛选 createdAt > cutoff 的任务

### 5.4 WikiPage（工作库）

**布局**: 左 8/24 + 右 16/24

**顶卡**
- 深蓝渐变背景
- 副标题："按项目分类，标签筛选，对话式洞察"

**左列 - 项目卡片**
- 每个卡片：项目icon(24px) + 项目名 + 任务数·已完成数 + Badge(待办数) + Progress条 + 标签(前4个)
- 点击选中：金色边框高亮；再次点击取消选中
- 待办Badge颜色：≥80%绿 / ≥50%黄 / <50%红
- 最大高度 `calc(100vh - 220px)` 可滚动

**右列 - 两种视图**

**未选项目时：对话式洞察**
- 聊天界面，消息区 + 输入区
- 空态：48px 📚 + "对话式工作洞察" + "点击左侧项目卡片查看详情，或在此对话提问"
- 消息：用户右对齐(深蓝气泡) / 助手左对齐(白色气泡+📚Avatar)
- 助手回答支持 Markdown 渲染
- 加载态：📚 Avatar + "分析中..." 半透明
- 输入：TextArea(autoSize 1~4行) + 提问按钮(40px高)
- Enter 发送，Shift+Enter 换行

**选中项目时：项目详情**
- 顶部：项目名 + 返回按钮 + 标签筛选行(4个Select: 项目/类型/优先级/状态)
- 下方两列：✅已完成 + ⏳待完成
- 完成项：标题删除线灰色 + 标签 + 完成日期
- 待办项：标题正常 + 标签 + 截止日期

### 5.5 AskMiraPage（问Mira）

**布局**: 顶卡 + 聊天区

**顶卡**
- 白色背景
- 标题 "🪞 Ask Mira" + 副标题 + 清空历史按钮

**聊天区**
- 高度 `calc(100vh - 220px)`，flex 布局
- 空态：48px 🪞 + "Ask Mira anything" + 示例提示
- 消息：用户右对齐(深蓝气泡+🪞Avatar) / 助手左对齐(白色气泡+🪞Avatar金色背景)
- 助手回答附带**来源卡片**：📎 来源标题 + 每条来源(蓝色Tag+摘要文本)
- 加载态：🪞 Avatar + "思考中..." 半透明
- 输入：TextArea(autoSize 1~4行) + 提问按钮(40px高)
- Enter 发送，Shift+Enter 换行

### 5.6 TalentPoolPage（人才库）

**布局**: 顶卡 + 筛选栏 + 成员卡片网格 + 详情Modal

**顶卡**
- 深蓝渐变背景
- 副标题："基于任务数据自动生成能力标签，多维度圈选团队成员"

**筛选栏**
- 3个 Select：按项目(200px) / 按能力类型(150px) / 按关键词(150px)
- 重置筛选按钮
- 筛选逻辑：AND 关系（三个维度同时满足）

**成员卡片网格**
- 3列 (Col span=8)
- 每张卡片：Avatar(48px,成员色) + 姓名+角色 + 已完成数(大字) + 完成率Progress条 + 能力Tags(前4个,超出显示+N)
- 卡片使用 `.project-card` 样式（hover上浮+阴影）
- 点击 → 打开详情Modal
- 无匹配：`<Empty description="没有匹配的团队成员" />`

**成员详情 Modal**
- 宽度 680px，无footer
- 标题区：Avatar(40px) + 姓名+角色
- 三列统计卡片：总任务(深蓝) / 已完成(绿) / 能力标签数(金色)
- 能力标签区：所有tags + weight 数值，颜色 type→gold/project→purple/keyword→blue
- 项目分布：项目名 + Progress条 + N项
- 近期任务：List组件，最多8条，按createdAt降序，显示状态emoji+标题+标签

---

## 六、UI 规范

### 6.1 品牌 Token（CSS 变量）

```css
:root {
  --mira-primary: #1B2A4E;      /* 深蓝 - 主色 */
  --mira-primary-2: #2C3F6B;    /* 浅深蓝 - 渐变副色 */
  --mira-gold: #E8B86D;         /* 金色 - 强调色 */
  --mira-gold-2: #F2D29B;       /* 浅金 - 悬浮态 */
  --mira-mist: #E7ECF3;         /* 雾蓝 - 分割线/边框 */
  --mira-bg: #F5F7FB;           /* 页面背景 */
  --mira-text: #1B2A4E;         /* 主文字 */
  --mira-text-muted: #6B7A99;   /* 次要文字 */
  --mira-success: #52C41A;      /* 成功/已完成 */
  --mira-warning: #FAAD14;      /* 警告/待完成 */
  --mira-danger: #FF4D4F;       /* 危险/紧急 */
}
```

### 6.2 Ant Design 主题覆盖

```javascript
ConfigProvider theme = {
  token: {
    colorPrimary: '#1B2A4E',
    colorLink: '#E8B86D',
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
  }
}
```

### 6.3 字体规范

| 用途         | 大小  | 字重 | 颜色              |
| ------------ | ----- | ---- | ----------------- |
| 页面标题 h3  | 20px  | 600  | #fff(深蓝背景上)  |
| 页面副标题   | 13px  | 400  | rgba(255,255,255,0.7) |
| 卡片标题     | 15px  | 600  | --mira-text       |
| 卡片标题竖线 | 4×15px| -    | --mira-gold       |
| 列表主文字   | 13px  | 400  | --mira-text       |
| 列表次文字   | 12px  | 400  | --mira-text-muted |
| 标签文字     | 11-12px| 400 | 根据Tag颜色       |
| 统计大数字   | 20-28px| 700 | 各语义色          |
| 聊天气泡     | 14px  | 400  | #fff(用户) / --mira-text(助手) |
| 来源卡片     | 12px  | 400  | --mira-text-muted |
| 时间戳       | 10px  | 400  | --mira-text-muted |
| 侧边栏菜单  | 14px  | 400/600 | 选中600/未选中400 |
| 侧边栏用户名| 13px  | 600  | --mira-text       |
| 侧边栏角色  | 11px  | 400  | --mira-text-muted |
| 品牌标语     | 11px  | 400  | --mira-text-muted |

### 6.4 布局尺寸

| 元素         | 尺寸                                    |
| ------------ | --------------------------------------- |
| Header       | height: 56px, padding: 0 24px          |
| Sider        | width: 200px, padding: 12px 0          |
| Content      | padding: 20px 28px                      |
| 卡片 mira-card | border-radius: 12px, padding: 20px, margin-bottom: 16px, box-shadow: 0 2px 8px rgba(27,42,78,0.04) |
| 聊天区       | height: calc(100vh - 220px)             |
| 已归档列表   | max-height: calc(100vh - 220px)         |
| 项目卡片列   | max-height: calc(100vh - 220px)         |

### 6.5 渐变背景

**深蓝渐变（顶卡/Header）**
```css
background: linear-gradient(135deg, #1B2A4E 0%, #2C3F6B 100%);
```

**菜单选中渐变**
```css
background: linear-gradient(135deg, #FFF7E6 0%, #FFEFD0 100%);
border: 1px solid #E8B86D;
```

**启动Loading渐变**
```css
background: linear-gradient(135deg, #1B2A4E 0%, #2C3F6B 100%);
```

### 6.6 组件样式细则

#### 卡片标题竖线
```css
.mira-card-title::before {
  content: "";
  width: 4px;
  height: 15px;
  background: var(--mira-gold);
  border-radius: 2px;
}
```
- 标题与竖线间距 gap: 8px

#### 顶卡水印 emoji
```css
position: absolute;
right: 24px;
top: 50%;
transform: translateY(-50%);
font-size: 80px;
opacity: 0.08;
```

#### 聊天气泡
```css
.chat-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.7;
  font-size: 14px;
  word-break: break-word;
}
.chat-bubble.user {
  background: linear-gradient(135deg, #1B2A4E 0%, #2C3F6B 100%);
  color: #fff;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}
.chat-bubble.assistant {
  background: #fff;
  border: 1px solid var(--mira-mist);
  border-bottom-left-radius: 4px;
}
```

#### 来源卡片
```css
.chat-source-card {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--mira-bg);
  border: 1px solid var(--mira-mist);
  font-size: 12px;
  color: var(--mira-text-muted);
}
```

#### 项目卡片
```css
.project-card {
  border: 1px solid var(--mira-mist);
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  cursor: pointer;
  transition: all 0.3s;
}
.project-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(27,42,78,0.12);
}
```

#### 报告预览
```css
.report-preview {
  padding: 20px;
  background: #fff;
  border: 1px solid var(--mira-mist);
  border-radius: 8px;
  font-size: 14px;
  line-height: 2;
}
```

#### Markdown 预览
```css
.md-preview {
  padding: 16px;
  background: #fff;
  border: 1px solid var(--mira-mist);
  border-radius: 8px;
  min-height: 200px;
  font-size: 14px;
  line-height: 1.8;
}
.md-preview h1, .md-preview h2, .md-preview h3 { color: var(--mira-primary); }
.md-preview blockquote { border-left: 4px solid var(--mira-gold); padding-left: 12px; color: var(--mira-text-muted); }
.md-preview code { background: var(--mira-bg); padding: 2px 6px; border-radius: 4px; }
```

#### 标签芯片
```css
.tag-chip.active {
  background: var(--mira-gold);
  color: var(--mira-primary);
  font-weight: 600;
}
.tag-chip.inactive {
  background: var(--mira-mist);
  color: var(--mira-text-muted);
}
```

#### 滚动条
```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(27,42,78,0.15); border-radius: 4px; }
```

### 6.7 侧边栏菜单项样式

```css
/* 未选中 */
padding: 10px 16px;
margin: 2px 8px;
border-radius: 8px;
border: 1px solid transparent;
font-weight: 400;
font-size: 14px;
transition: all 0.15s;

/* 选中 */
background: linear-gradient(135deg, #FFF7E6 0%, #FFEFD0 100%);
border: 1px solid #E8B86D;
color: var(--mira-primary);
font-weight: 600;

/* Hover(未选中时) */
background: #F5F7FB;
```

### 6.8 侧边栏用户区域

```css
padding: 12px 16px;
border-bottom: 1px solid var(--mira-mist);
margin-bottom: 8px;
```

- Avatar: size=36, background=#E8B86D, fontSize=18, emoji=🪞
- 用户名格式: `Mira·{Self|Team}` (13px, 600)
- 角色文字: "咨询运营项目经理" / "团队管理者" (11px, muted)
- Segmented: size=small, block, 选项: 👤个人 / 👥管理

### 6.9 侧边栏底部标语

```css
padding: 10px;
background: var(--mira-bg);
border-radius: 8px;
font-size: 11px;
color: var(--mira-text-muted);
line-height: 1.6;
```

内容: `🪞 Every step matters. 随手记录，智写总结 标签分类，洞察工作。`

### 6.10 Ant Design 组件使用规范

| 组件        | 变体/尺寸                                    |
| ----------- | --------------------------------------------- |
| Button      | type=primary (主操作), size=small (辅助), type=text danger (删除) |
| Input       | 默认尺寸; 日期用 type=date                     |
| TextArea    | rows=3 (Modal), autoSize={minRows:1, maxRows:4} (聊天) |
| Select      | size=small, allowClear; 宽度按需(120-200px)    |
| Tag         | color=purple(项目), gold(类型/能力), blue(关键词/来源), 语义色(优先级) |
| Avatar      | size=32(聊天), 36(侧边栏/团队成员列表), 48(人才库卡片) |
| Modal       | 默认宽度(任务), 680px(人才详情)                |
| Progress    | size=small, strokeColor 随完成率变色           |
| Segmented   | size=small, block(视角切换)                    |
| Badge       | count=待办数, 颜色随完成率                      |
| Empty       | description=文案, image=PRESENTED_IMAGE_SIMPLE(紧凑区) |
| Popconfirm  | title="确认删除？"                              |
| notification| placement=bottomRight, duration=2, 成功通知     |
| message     | success("已复制"/"任务已创建"/"任务已更新"/"已清空") |
| Checkbox    | 用于任务完成/人员选择                           |
| ConfigProvider | 全局主题如上                                  |

---

## 七、状态/空态/加载态规范

### 7.1 空态

| 位置                 | 图标  | 文案                                   | Empty类型              |
| -------------------- | ----- | -------------------------------------- | ---------------------- |
| 待办列表             | -     | "暂无待办"                             | 默认                   |
| 已归档               | -     | "暂无已完成事项"                       | PRESENTED_IMAGE_SIMPLE |
| 报告-工作项          | -     | "该时段暂无工作项"                     | 默认                   |
| 报告-预览(个人)      | 📝    | "勾选左侧工作项后点击生成{周期}报"      | 自定义居中             |
| 报告-预览(团队)      | 👥    | "勾选左侧团队成员后点击生成团队{周期}报"| 自定义居中             |
| 工作库-对话(未选项目) | 📚    | "对话式工作洞察" + 副文案              | 自定义居中             |
| 工作库-已完成        | -     | "暂无"                                 | PRESENTED_IMAGE_SIMPLE |
| 工作库-待完成        | -     | "暂无"                                 | PRESENTED_IMAGE_SIMPLE |
| 问Mira               | 🪞    | "Ask Mira anything" + 示例提示         | 自定义居中             |
| 人才库-无匹配        | -     | "没有匹配的团队成员"                   | 默认                   |

### 7.2 加载态

| 位置         | Avatar | 文字       | 延迟             |
| ------------ | ------ | ---------- | ---------------- |
| 问Mira       | 🪞 金色背景 | "思考中..." | 800+random(600)ms |
| 工作库对话   | 📚 金色背景 | "分析中..." | 500+random(400)ms |

- 加载中输入框 disabled，提问按钮 loading
- 回答到达后自动 scrollIntoView({ behavior: 'smooth' })

### 7.3 通知/反馈

| 触发               | 类型         | 内容                                       | 位置        | 时长 |
| ------------------ | ------------ | ------------------------------------------ | ----------- | ---- |
| 任务标记完成       | notification | "✅ 已完成" + "「{title}」已归档"           | bottomRight | 2s   |
| 任务创建/更新      | message      | "任务已创建" / "任务已更新"                 | -           | 默认 |
| 报告复制           | message      | "已复制"                                    | -           | 默认 |
| 清空对话           | message      | "已清空"                                    | -           | 默认 |
| 保存校验失败       | message      | "请输入标题" (warning)                      | -           | 默认 |
| 确认删除           | Popconfirm   | "确认删除？"                                | -           | -    |

---

## 八、启动画面（Boot Loading）

```css
.boot-loading {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1B2A4E 0%, #2C3F6B 100%);
  color: #fff;
}
.boot-logo { font-size: 64px; margin-bottom: 16px; animation: pulse 2s infinite; }
.boot-title { font-size: 32px; font-weight: 600; letter-spacing: 4px; margin-bottom: 8px; }
.boot-tip { font-size: 14px; opacity: 0.7; letter-spacing: 2px; }

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
```

内容: 🪞 + "Mira ｜ 见微" + "See every step. Shape every you."

React 挂载后自动替换为应用界面。

---

## 九、数据流图

```
┌─────────────────────────────────────────────────┐
│                   localStorage                   │
│            (mira_app_state_v4)                   │
└──────────────────────┬──────────────────────────┘
                       │ load() on init
                       ▼
┌─────────────────────────────────────────────────┐
│              StoreProvider (state)               │
│  { tasks, projects, route, chatHistory,          │
│    wikiChatHistory }                             │
└──────────┬──────────────────────────────────────┘
           │ useEffect → save()
           │
     ┌─────┼─────────────────────────┐
     ▼     ▼                         ▼
  MainLayout  RouteRenderer    ChatPages
  (route→menu) (route→page)   (chatHistory/wikiChatHistory)
     │
     ├── TasksPage ─── addTask/updateTask/removeTask
     ├── ReportPage ─ (read-only, uses assignTasksToMembers)
     ├── WikiPage ─── addWikiChatMessage/clearWikiChat
     ├── AskMiraPage ─ addChatMessage/clearChat
     └── TalentPoolPage ─ (read-only, uses computeMemberAbilities)
```

**关键数据流**:

1. **任务流**: TasksPage (CRUD) → state.tasks → ReportPage/WikiPage/AskMiraPage/TalentPoolPage (读取+计算)
2. **报告流**: state.tasks + 周期筛选 + 用户选择 → polishReport/generateTeamReport → Markdown渲染
3. **对话流**: 用户输入 → addChatMessage/addWikiChatMessage → 关键词匹配 → 追加助手消息
4. **人才流**: state.tasks → assignTasksToMembers → computeMemberAbilities → 维度圈选 → 成员详情
5. **持久化流**: state变更 → useEffect → localStorage.save() → 页面刷新 → localStorage.load()
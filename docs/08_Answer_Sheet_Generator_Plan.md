# 答题卡生成与批量打印功能设计方案

## 1. 功能概述 (Overview)
本模块旨在为教师提供一个灵活的答题卡（Answer Sheet）生成工具。支持自定义题型区域（选择、判断、填空、简答、作文），并集成学生信息（二维码），实现一键批量生成全班学生的个性化答题卡，便于后续扫描与自动/辅助阅卷。

## 2. 核心功能需求 (Core Requirements)

### 2.1 答题卡布局设计 (Layout Designer)
用户（教师）可以通过可视化界面配置答题卡结构：
- **基础信息**：考试名称、科目、班级。
- **版面设置**：A4/A3 纸张，单栏/双栏布局。
- **题型区域**：
  1.  **选择题 (Multiple Choice)**：支持设置题号范围（如 1-20）、选项数量（A-D / A-F）、排列方式（横向/纵向）。
  2.  **判断题 (True/False)**：T/F 或 √/× 填涂区。
  3.  **填空题 (Fill-in-the-Blank)**：根据字数限制生成下划线或方格。
  4.  **简答/计算题 (Short Answer)**：空白区域或辅助横线。
  5.  **作文 (Composition)**：带有字数标记的方格稿纸（如 800 字）。

### 2.2 学生身份识别 (Student Identity)
- **二维码/条形码区域**：
  - 自动生成包含学生唯一标识（Student ID / Exam ID）的二维码。
  - 位于答题卡页眉右上角，便于扫描仪或摄像头快速定位与识别。
- **明文信息**：显示姓名、学号、考号等便于人工核对。

### 2.3 批量生成与打印 (Batch Generation)
- **数据源导入**：
  - **数据库集成 (Database Integration)**：通过 `/api/admin/students` 接口直接获取学生名单。
  - **Excel 导入**：保留作为备选方案。
- **筛选与选择**：
  - 支持按班级 (Class) 筛选学生。
  - 支持全选/多选指定学生。
- **一键渲染**：
  - 根据学生名单，循环生成 N 份答题卡。
  - 自动分页，生成单一 PDF 文件或连续的 HTML 打印流。

## 3. 技术架构 (Technical Architecture)

### 3.1 前端技术栈 (Frontend)
- **框架**：Vue 3 (基于 `apps/quiz-builder` 现有架构).
- **UI 组件库**：Tailwind CSS (用于精确的打印布局控制).
- **二维码生成**：`qrcode` 或 `vue-qr` 库.
- **打印实现**：
  - 方案 A (推荐)：使用 CSS `@media print` 进行网页直打。利用浏览器原生的打印预览及 PDF 导出功能，开发成本低，样式调整灵活。
  - 方案 B：使用 `jspdf` + `html2canvas` 生成图片/PDF。适合对排版有像素级严格要求的场景，但文字清晰度可能受损。

### 3.2 数据结构设计 (Data Structure)

#### 试卷配置 (Quiz Config)
```typescript
interface QuizLayout {
  title: string;
  paperSize: 'A4' | 'A3';
  sections: QuizSection[];
}

type SectionType = 'choice' | 'judge' | 'blank' | 'text' | 'essay';

interface QuizSection {
  id: string;
  type: SectionType;
  title: string; // e.g., "一、选择题"
  count: number; // 题目数量
  options?: string[]; // e.g., ['A','B','C','D']
  scorePerQuestion?: number;
  layout: 'grid' | 'list'; // 排列方式
}
```

#### 学生数据 (Student Data)
```typescript
interface Student {
  id: string;
  name: string;
  classId: string;
  examNo: string; // 考号
}
```

## 4. 实施步骤 (Implementation Steps)

### 第一阶段：设计器与预览 (Designer & Preview)
1.  在 `apps/quiz-builder` 中新建 `AnswerSheetDesigner` 组件。
2.  实现各题型（选择、作文格等）的 CSS 打印样式组件。
3.  实现基础布局配置（纸张大小、标题）。

### 第二阶段：二维码与名单集成 (QR & Batch)
1.  引入二维码生成库。
2.  集成 Excel 导入功能（参考 `StudentsToExcel` 文件解析逻辑）。
3.  实现 `StudentAnswerSheet` 组件，接受 `Student` 和 `QuizLayout` props。

### 第三阶段：打印优化 (Print Optimization)
1.  调整 CSS 打印样式，确保分页正确（`break-inside: avoid`）。
2.  实现批量渲染视图，隐藏非打印 UI 元素。

## 5. 预期效果 (Expected Outcome)
教师上传名单，配置好题目数量后，点击“生成答题卡”，即可得到一个包含全班所有学生个人信息的 PDF 打印文件，每张答题卡右上角均印有专属二维码。

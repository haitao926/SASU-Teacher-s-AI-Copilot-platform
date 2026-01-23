# 后端需求文档：基于 MinerU 的结构化 OCR 接口

为了将阅卷模式从“前端裁切+多次请求”升级为“整页识别+坐标归属”，我们需要后端提供具备**位置信息 (BBox)** 的结构化 OCR 接口。

---

## 1. 接口功能目标
提供一个端点，接收整页试卷图片，返回页面上所有识别到的文本块及其精确坐标。前端将利用这些坐标，结合预设的题目区域（ROI），自动将文字分配给对应的题目。

## 2. 建议接口定义

### 2.1 提交任务
- **Endpoint**: `POST /api/ocr/predict_structure` (或复用 `/api/ocr/upload` 并带参数 `return_bbox=true`)
- **Request**:
  - `file`: 图片文件 (JPG/PNG/PDF Page)
  - `scene`: `exam` (推荐，针对试卷手写体/公式优化)
- **Response**:
  ```json
  {
    "code": 0,
    "taskId": "task_12345678",
    "status": "pending"
  }
  ```

### 2.2 获取结果 (轮询)
- **Endpoint**: `GET /api/ocr/result/{taskId}`
- **Response (Success)**:
  ```json
  {
    "status": "done",
    "result": {
      "width": 2480,          // [重要] 图片原始宽度，用于坐标映射
      "height": 3508,         // [重要] 图片原始高度
      "blocks": [             // 文本块列表
        {
          "id": 1,
          "text": "一、选择题",
          "bbox": [100, 100, 500, 150], // [x, y, w, h] 或 [x1, y1, x2, y2]，需约定清楚
          "type": "header"
        },
        {
          "id": 2,
          "text": "A",
          "bbox": [120, 200, 150, 230], // 关键：手写识别结果的位置
          "type": "handwriting"        // 若能区分手写/印刷体更佳
        }
      ]
    }
  }
  ```

## 3. 关键技术指标

### 3.1 坐标系一致性
- 返回的 `bbox` 坐标必须基于传入图片的**原始像素分辨率**。
- 如果后端对图片进行了缩放/压缩处理，必须将坐标还原回原始尺寸，或者返回处理后的 `width/height` 供前端对齐。

### 3.2 颗粒度要求
- 为了准确区分紧凑排列的填空题或选择题，OCR 结果最好能提供 **行级 (Line)** 甚至 **片段级 (Span)** 的 BBox。
- 仅提供段落级 (Paragraph) BBox 可能导致多个小题被合并，难以拆分。

### 3.3 并发控制
- 批量阅卷会瞬间产生大量请求（如 50 页/次）。
- 后端应实现**队列机制**，控制 GPU 并发数，避免服务崩溃。

## 4. 现有字段映射参考 (基于 09 文档)
如果集成 MinerU，期望透传以下字段：
- `spans[].content` -> 识别文本
- `spans[].bbox` -> 坐标
- `page_info.width/height` -> 页面尺寸

---

**前端后续动作**:
一旦后端就绪，前端将移除 `cropImageRegion` (裁切) 逻辑，改为：
1. 发送整页图。
2. 获取上述 JSON。
3. 遍历 `blocks`，计算 `block.center` 是否在 `question.roi` 内。
4. 归集文本并判分。

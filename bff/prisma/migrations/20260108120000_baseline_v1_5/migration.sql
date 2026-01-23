-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEACHER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "loginFailures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "metadata" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tag" TEXT,
    "tagType" TEXT NOT NULL DEFAULT 'info',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT,
    CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tool_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "contentUrl" TEXT,
    "metadata" TEXT,
    "type" TEXT NOT NULL,
    "tags" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "authorId" TEXT NOT NULL,
    "toolId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "class" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "value" REAL NOT NULL,
    "subject" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "updatedBy" TEXT,
    "sourceEventId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Score_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Score_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Score_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "LearningEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnswerKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "assignmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "points" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerKey_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalScore" REAL NOT NULL DEFAULT 0,
    "payloadUrl" TEXT,
    "sourceEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "LearningEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "submissionId" TEXT NOT NULL,
    "objectiveScore" REAL NOT NULL DEFAULT 0,
    "subjectiveScore" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL DEFAULT 0,
    "details" TEXT,
    "reviewedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradingResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "appCode" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "payload" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "usage" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "groupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Entry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortalUiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "homeTitle" TEXT NOT NULL DEFAULT '常用应用',
    "homeSubtitle" TEXT NOT NULL DEFAULT '您收藏的教学工具，触手可及',
    "tipsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tipsTitle" TEXT NOT NULL DEFAULT 'AI 提问小技巧',
    "tipsContent" TEXT NOT NULL DEFAULT '试着给 AI 一个具体的“身份”，比如“你是一位有20年经验的中学数学老师”，它的回答会更专业哦。',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OcrTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fullZipUrl" TEXT,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "stem" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT,
    "answer" TEXT,
    "analysis" TEXT,
    "subject" TEXT,
    "grade" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "knowledgePoints" TEXT,
    "attachments" TEXT,
    "sourceAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE INDEX "User_tenantId_status_idx" ON "User"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- CreateIndex
CREATE INDEX "Tool_tenantId_category_idx" ON "Tool"("tenantId", "category");

-- CreateIndex
CREATE INDEX "Tool_tenantId_status_idx" ON "Tool"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_tenantId_code_key" ON "Tool"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_tenantId_route_key" ON "Tool"("tenantId", "route");

-- CreateIndex
CREATE INDEX "Asset_tenantId_type_idx" ON "Asset"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Asset_tenantId_visibility_idx" ON "Asset"("tenantId", "visibility");

-- CreateIndex
CREATE INDEX "Asset_tenantId_authorId_idx" ON "Asset"("tenantId", "authorId");

-- CreateIndex
CREATE INDEX "Asset_tenantId_toolId_idx" ON "Asset"("tenantId", "toolId");

-- CreateIndex
CREATE INDEX "Student_tenantId_class_idx" ON "Student"("tenantId", "class");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_studentId_key" ON "Student"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Exam_tenantId_date_idx" ON "Exam"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_tenantId_name_key" ON "Exam"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Score_tenantId_examId_idx" ON "Score"("tenantId", "examId");

-- CreateIndex
CREATE INDEX "Score_tenantId_studentId_idx" ON "Score"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Score_tenantId_subject_idx" ON "Score"("tenantId", "subject");

-- CreateIndex
CREATE INDEX "Score_tenantId_sourceEventId_idx" ON "Score"("tenantId", "sourceEventId");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_subject_idx" ON "Assignment"("tenantId", "subject");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_status_idx" ON "Assignment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerKey_tenantId_assignmentId_questionId_key" ON "AnswerKey"("tenantId", "assignmentId", "questionId");

-- CreateIndex
CREATE INDEX "Submission_tenantId_assignmentId_idx" ON "Submission"("tenantId", "assignmentId");

-- CreateIndex
CREATE INDEX "Submission_tenantId_studentId_idx" ON "Submission"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Submission_tenantId_status_idx" ON "Submission"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Submission_tenantId_sourceEventId_idx" ON "Submission"("tenantId", "sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingResult_submissionId_key" ON "GradingResult"("submissionId");

-- CreateIndex
CREATE INDEX "LearningEvent_tenantId_actorId_idx" ON "LearningEvent"("tenantId", "actorId");

-- CreateIndex
CREATE INDEX "LearningEvent_tenantId_action_idx" ON "LearningEvent"("tenantId", "action");

-- CreateIndex
CREATE INDEX "LearningEvent_tenantId_appCode_idx" ON "LearningEvent"("tenantId", "appCode");

-- CreateIndex
CREATE INDEX "LearningEvent_tenantId_occurredAt_idx" ON "LearningEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "PortalUiConfig_tenantId_idx" ON "PortalUiConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalUiConfig_tenantId_key" ON "PortalUiConfig"("tenantId");

-- CreateIndex
CREATE INDEX "Question_tenantId_subject_idx" ON "Question"("tenantId", "subject");

-- CreateIndex
CREATE INDEX "Question_tenantId_grade_idx" ON "Question"("tenantId", "grade");

-- CreateIndex
CREATE INDEX "Question_tenantId_status_idx" ON "Question"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Question_tenantId_sourceAssetId_idx" ON "Question"("tenantId", "sourceAssetId");


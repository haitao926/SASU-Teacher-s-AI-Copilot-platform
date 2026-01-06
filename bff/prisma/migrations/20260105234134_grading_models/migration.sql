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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "GradingResult_submissionId_key" ON "GradingResult"("submissionId");


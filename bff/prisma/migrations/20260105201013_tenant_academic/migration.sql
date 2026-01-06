-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL
);
INSERT INTO "new_Exam" ("date", "id", "name", "type") SELECT "date", "id", "name", "type" FROM "Exam";
DROP TABLE "Exam";
ALTER TABLE "new_Exam" RENAME TO "Exam";
CREATE INDEX "Exam_tenantId_date_idx" ON "Exam"("tenantId", "date");
CREATE UNIQUE INDEX "Exam_tenantId_name_key" ON "Exam"("tenantId", "name");
CREATE TABLE "new_Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "value" REAL NOT NULL,
    "subject" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Score_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Score_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Score" ("examId", "id", "studentId", "subject", "updatedAt", "updatedBy", "value") SELECT "examId", "id", "studentId", "subject", "updatedAt", "updatedBy", "value" FROM "Score";
DROP TABLE "Score";
ALTER TABLE "new_Score" RENAME TO "Score";
CREATE INDEX "Score_tenantId_examId_idx" ON "Score"("tenantId", "examId");
CREATE INDEX "Score_tenantId_studentId_idx" ON "Score"("tenantId", "studentId");
CREATE INDEX "Score_tenantId_subject_idx" ON "Score"("tenantId", "subject");
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "class" TEXT NOT NULL
);
INSERT INTO "new_Student" ("class", "id", "name", "studentId") SELECT "class", "id", "name", "studentId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_tenantId_class_idx" ON "Student"("tenantId", "class");
CREATE UNIQUE INDEX "Student_tenantId_studentId_key" ON "Student"("tenantId", "studentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


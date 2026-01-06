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
    CONSTRAINT "Asset_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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


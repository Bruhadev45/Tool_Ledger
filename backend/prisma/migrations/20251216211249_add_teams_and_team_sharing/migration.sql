-- AlterTable
ALTER TABLE "users" ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_team_shares" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "permission" "CredentialPermission" NOT NULL DEFAULT 'VIEW_ONLY',
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "credential_team_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_organizationId_idx" ON "teams"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organizationId_name_key" ON "teams"("organizationId", "name");

-- CreateIndex
CREATE INDEX "credential_team_shares_teamId_idx" ON "credential_team_shares"("teamId");

-- CreateIndex
CREATE INDEX "credential_team_shares_credentialId_idx" ON "credential_team_shares"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "credential_team_shares_credentialId_teamId_key" ON "credential_team_shares"("credentialId", "teamId");

-- CreateIndex
CREATE INDEX "users_teamId_idx" ON "users"("teamId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_team_shares" ADD CONSTRAINT "credential_team_shares_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_team_shares" ADD CONSTRAINT "credential_team_shares_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

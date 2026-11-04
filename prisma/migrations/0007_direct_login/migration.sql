CREATE TABLE "DirectLoginWorkspace" ("sessionId" TEXT PRIMARY KEY REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE, "payload" JSONB NOT NULL);
CREATE TABLE "ReferenceProviderWorkspace" ("sessionId" TEXT PRIMARY KEY REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE, "payload" JSONB NOT NULL);
CREATE TABLE "DirectLoginClient" (
 "clientId" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "providerId" TEXT NOT NULL, "name" TEXT NOT NULL, "secretHash" TEXT NOT NULL, "callbackUrl" TEXT NOT NULL, "loginStartUrl" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL, "kind" TEXT NOT NULL, "revision" INTEGER NOT NULL, "acquisitionRateRial" BIGINT,
 UNIQUE ("sessionId", "providerId")
);

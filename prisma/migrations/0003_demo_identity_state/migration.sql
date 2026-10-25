-- Sign-out preserves identity-owned saves until the reviewer sandbox expires/resets.
ALTER TABLE "DemoIdentity" ADD COLUMN "signedIn" BOOLEAN NOT NULL DEFAULT true;

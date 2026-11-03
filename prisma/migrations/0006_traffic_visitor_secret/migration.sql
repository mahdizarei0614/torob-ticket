-- Independent server-only HMAC key. Existing scopes initialize lazily at explicit bootstrap.
ALTER TABLE "DemoSession" ADD COLUMN "trafficVisitorSecret" TEXT;
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_trafficVisitorSecret_shape"
CHECK ("trafficVisitorSecret" IS NULL OR "trafficVisitorSecret" ~ '^[A-Za-z0-9_-]{43}$');

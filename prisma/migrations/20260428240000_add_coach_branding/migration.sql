-- AlterTable: public booking page customization (all nullable)
ALTER TABLE "Coach" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Coach" ADD COLUMN "bio" TEXT;
ALTER TABLE "Coach" ADD COLUMN "publicEmail" TEXT;
ALTER TABLE "Coach" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "Coach" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Coach" ADD COLUMN "venmoHandle" TEXT;
ALTER TABLE "Coach" ADD COLUMN "cashAppHandle" TEXT;
ALTER TABLE "Coach" ADD COLUMN "zelleInfo" TEXT;
ALTER TABLE "Coach" ADD COLUMN "cashInstructions" TEXT;

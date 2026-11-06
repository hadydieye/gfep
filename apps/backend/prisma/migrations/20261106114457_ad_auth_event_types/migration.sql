-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuthEventType" ADD VALUE 'AD_SERVICE_BIND_FAILED';
ALTER TYPE "AuthEventType" ADD VALUE 'AD_USER_NOT_FOUND';
ALTER TYPE "AuthEventType" ADD VALUE 'AD_NO_EMPLOYEE_MATCH';
ALTER TYPE "AuthEventType" ADD VALUE 'AD_NO_ROLE_MAPPING';
ALTER TYPE "AuthEventType" ADD VALUE 'AD_LOCAL_ACCOUNT_CONFLICT';

-- CreateEnum
CREATE TYPE "DocumentValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "validationStatus" "DocumentValidationStatus" NOT NULL DEFAULT 'PENDING';

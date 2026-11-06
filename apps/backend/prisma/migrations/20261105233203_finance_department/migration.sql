-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_departmentId_idx" ON "invoices"("departmentId");

-- CreateIndex
CREATE INDEX "transactions_departmentId_idx" ON "transactions"("departmentId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('PITCH', 'LEGAL', 'NOTE');

-- CreateTable
CREATE TABLE "vault_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vault_documents_user_id_updated_at_idx" ON "vault_documents"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

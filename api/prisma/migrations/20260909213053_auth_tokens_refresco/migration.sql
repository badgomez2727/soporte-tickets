-- CreateTable
CREATE TABLE "tokens_refresco" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "fecha_revocacion" TIMESTAMP(3),

    CONSTRAINT "tokens_refresco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_refresco_token_hash_key" ON "tokens_refresco"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_refresco_usuario_id_idx" ON "tokens_refresco"("usuario_id");

-- AddForeignKey
ALTER TABLE "tokens_refresco" ADD CONSTRAINT "tokens_refresco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products" ADD COLUMN "qr_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "qr_code_idx" ON "products" USING btree ("qr_code");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_qr_code_unique" UNIQUE("qr_code");
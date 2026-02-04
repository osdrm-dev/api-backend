/*
  Warnings:

  - The values [USER,MODERATOR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `emailVerifiedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isEmailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `password_resets` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fonction` to the `users` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('DEMANDEUR', 'OM', 'CFO', 'CEO', 'DP', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'DEMANDEUR';
COMMIT;

-- DropForeignKey
ALTER TABLE "password_resets" DROP CONSTRAINT "password_resets_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailVerifiedAt",
DROP COLUMN "isEmailVerified",
ADD COLUMN     "fonction" TEXT NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'DEMANDEUR';

-- DropTable
DROP TABLE "password_resets";

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

export class SignatureSpecimenResponseDto {
  id: number;
  userId: number;
  fileId: number;
  isActive: boolean;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

export class DeleteSignatureResponseDto {
  requiresNewActive: boolean;
  remainingSpecimens: SignatureSpecimenResponseDto[];
}
